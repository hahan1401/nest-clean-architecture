# Clean Architecture - NestJS Microservices + Prisma

## High-Level Overview

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         API Gateway (HTTP :3000)                            │
│      Validates HTTP requests and forwards to internal TCP microservices     │
└──────────────────────────────────────────────────────────────────────────────┘
                  │               │               │
                  │               │               │
                  ▼               ▼               ▼
       ┌─────────────────┐ ┌───────────────┐ ┌─────────────────┐
       │ api-user :3001  │ │ api-payment   │ │ api-chatbot     │
       │ User operations │ │ :3003         │ │ :3004           │
       └───────┬─────────┘ │ VNPay adapter │ │ SSE + RAG docs  │
               │           └───────────────┘ └─────────────────┘
               ▼
       ┌─────────────────┐
       │ api-location    │
       │ :3002           │
       │ reverse geocode │
       └─────────────────┘
               │
               ▼
       ┌─────────────────┐
       │ PostgreSQL DB   │
       │ (Prisma)        │
       └─────────────────┘
```

## Repository Layout

```
nest-clean-architecture/
├── apps/
│   ├── api-gateway/   # HTTP gateway, routes to USER/PAYMENT/CHATBOT services
│   ├── api-user/      # User service (TCP)
│   ├── api-location/  # Geocoding service (TCP)
│   ├── api-payment/   # Payment service (TCP, VNPay integration)
│   ├── api-chatbot/   # Chatbot + document ingestion service (TCP)
│   └── api-notification/ # Real-time notifications (RabbitMQ consumer + Socket.IO)
│
├── libs/
│   ├── common/        # Shared constants, DTOs, error model, filters, logger config
│   ├── database/      # PrismaService + DatabaseModule + entities
│   ├── middlewares/   # Correlation request id middleware
│   └── types/         # Shared cross-service types
│
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   └── migrations/
│
├── docker-compose.yaml
├── nest-cli.json
├── tsconfig.json
└── package.json
```

---

## Apps

| App | Default Port | Transport | Role |
|-----|--------------|-----------|------|
| `api-gateway` | 3000 | HTTP | Entry point, validation, and HTTP-to-TCP proxy |
| `api-user` | 3001 | TCP | User CRUD, location update, nearby-user queries |
| `api-location` | 3002 | TCP | Reverse geocoding service |
| `api-payment` | 3003 | TCP | VNPay operations: bank list, QR, payment URL, return verification |
| `api-chatbot` | 3004 | TCP | Streaming chatbot responses and document upsert/update/delete |
| `api-notification` | 3005 | RabbitMQ + Socket.IO | Consumes notification events and pushes them to connected clients |

---

## Clean Architecture Per Service

The microservices (`api-user`, `api-location`, `api-payment`, `api-chatbot`) follow the same layered structure:

```
┌──────────────────────────────────────────────────────────┐
│                    Presentation Layer                    │
│         (@MessagePattern controllers, modules)           │
├──────────────────────────────────────────────────────────┤
│                    Application Layer                     │
│                 (Use case implementations)               │
├──────────────────────────────────────────────────────────┤
│                      Domain Layer                        │
│            (Ports, contracts, use case APIs)             |
|                zero framework dependencies               │
├──────────────────────────────────────────────────────────┤
│                   Infrastructure Layer                   │
│      (Prisma repos, external adapters: HTTP/VNPay)       │
└──────────────────────────────────────────────────────────┘
```

### Dependency Rule

```
Presentation -> Application -> Domain <- Infrastructure
```

Dependencies point inward only.

---

## Layer Responsibilities

### 1) Domain Layer (`domain/`)

- Defines business contracts and use case interfaces.
- No framework decorators.
- No infra or transport coupling.
- Signals failures with `DomainError` subclasses from `@app/common`, never with `HttpException`/`RpcException`.

Typical folders:
- `domain/repositories` (when persistence abstractions are needed, eg `api-user`)
- `domain/ports` (external adapter contracts, eg geocoding, VNPay, chatbot provider)
- `domain/usecases`

### 2) Application Layer (`application/`)

- Implements use cases with `execute(...)` methods.
- Orchestrates domain contracts and ports.
- Contains service-level workflow logic.
- Throws `DomainError` subclasses; contains no `try/catch` used purely to remap errors.

### 3) Infrastructure Layer (`infrastructure/`)

- Provides concrete implementations of domain contracts.
- Uses Prisma (`@app/database`) and external integrations (Nominatim, VNPay, Gemini).
- Wraps third-party failures in `DependencyError` so callers stay transport-agnostic.

### 4) Presentation Layer (`presentation/`)

- Handles transport concerns (`@MessagePattern` in microservices, HTTP in gateway).
- Maps transport payloads to use case calls.
- Contains no error-handling code: global exception filters perform transport translation.

---

## Error Handling

Errors are modelled once in the domain and translated exactly once at the transport boundary.

```
Domain/Application            Boundary (filters)             Caller
─────────────────────────────────────────────────────────────────────
throw NotFoundError    ->   AllExceptionsRpcFilter    ->   RpcException
                                                            { code, status,
                                                              message, requestId }
                                ↓ (forwarded over TCP)
                           AllExceptionsHttpFilter    ->   HTTP 404 JSON body
```

`@app/common` provides:

| Error | `ErrorCode` | HTTP status |
|-------|-------------|-------------|
| `ValidationError` | `VALIDATION` | 400 |
| `UnauthorizedError` | `UNAUTHORIZED` | 401 |
| `ForbiddenError` | `FORBIDDEN` | 403 |
| `NotFoundError` | `NOT_FOUND` | 404 |
| `ConflictError` | `CONFLICT` | 409 |
| `DependencyError` | `DEPENDENCY_FAILURE` | 502 |
| _(anything else)_ | `INTERNAL` | 500 |

- `AllExceptionsRpcFilter` (microservices) converts any thrown value into a stable
  `{ code, status, message, requestId }` envelope carried by `RpcException`.
- `AllExceptionsHttpFilter` (gateway) unwraps that envelope — or any local error — into
  `{ statusCode, code, message, requestId, timestamp, path }`.
- `normalizeError()` is the single translation point and understands `DomainError`,
  `RpcException`, `HttpException` and serialized envelopes forwarded across TCP.
- Both filters are registered globally via `APP_FILTER` in every app module.

Rules of thumb:

- Never import `@nestjs/common` exceptions in `domain/` or `application/`.
- Only catch an error if you add context or a fallback; otherwise let it bubble to the filter.
- Unexpected errors are logged with a stack trace but returned to clients as a generic 500.

---

## API Gateway

The gateway is intentionally thin and uses three TCP clients:

- `USER_SERVICE` on `USER_SERVICE_HOST:USER_SERVICE_PORT`
- `PAYMENT_SERVICE` on `PAYMENT_SERVICE_HOST:PAYMENT_SERVICE_PORT`
- `CHATBOT_SERVICE` on `CHATBOT_SERVICE_HOST:CHATBOT_SERVICE_PORT`

Key behaviors:

- Applies global `ValidationPipe` (`whitelist + transform`).
- Uses `CorrelationRequestIdMiddleware` for request correlation.
- Registers `AllExceptionsHttpFilter` and `LoggingInterceptor` globally.
- Routes HTTP requests to microservices through `ClientProxy.send(...)`.
- Exposes SSE endpoints for chatbot streaming.

---

## Shared Libraries

### `@app/common`

Exports:

- Service tokens: `USER_SERVICE`, `GEOCODING_SERVICE`, `PAYMENT_SERVICE`, `CHATBOT_SERVICE`
- Message pattern groups: `USER_PATTERNS`, `GEOCODING_PATTERNS`, `PAYMENT_PATTERNS`, `CHATBOT_PATTERNS`
- DTOs used by gateway and user service (`CreateUserDto`, `UpdateUserDto`, `UpdateLocationDto`, response DTOs)
- Error model: `DomainError` hierarchy, `ErrorCode`, `normalizeError`
- Boundary filters: `AllExceptionsHttpFilter`, `AllExceptionsRpcFilter`
- Shared pino logger config (`createPinoHttpConfig`) and `LoggingInterceptor`

### `@app/database`

Exports:

- `PrismaService`
- `DatabaseModule`
- Shared entities/types used across services

### Logging Strategy

`nestjs-pino` is the only logging implementation — the NestJS built-in `Logger` is not used
anywhere, including during bootstrap.

- Every app registers `LoggerModule.forRoot({ pinoHttp: createPinoHttpConfig('<SERVICE>') })`;
  the service label is set per app (`API-GATEWAY`, `API-USER`, `API-LOCATION`, `API-PAYMENT`,
  `API-CHATBOT`).
- Bootstrap uses `bufferLogs: true` + `app.flushLogs()` so Nest's own startup output is
  replayed through pino instead of the default console logger.
- Classes inject `PinoLogger` and call `setContext(...)`; log calls use pino's
  `(mergingObject, message)` signature so fields stay structured.
- `LoggingInterceptor` is registered globally (`APP_INTERCEPTOR`) in every app and records
  request start / completed / failed together with the duration, for both HTTP and RPC.
- Sensitive fields (`password`, `authorization`, `vnp_HashSecret`) are redacted by the shared
  pino config.

### Request Correlation

- `CorrelationRequestIdMiddleware` honours an inbound `x-request-id` header and falls back to a
  generated UUID, then echoes it back on the response.
- The gateway forwards `requestId` on object-shaped TCP payloads; the microservice
  `ValidationPipe` (`whitelist`) strips it before it reaches handlers, while the interceptor
  still logs it.
- Filters attach `requestId` to every error response, so a failure can be traced from the HTTP
  edge down to the service that raised it.

---

## Message Patterns

### User Service (`api-user`)

| Pattern | Payload | Description |
|---------|---------|-------------|
| `create_user` | `{ name, email, password }` | Create user |
| `get_users` | `{}` | List users |
| `get_user_by_id` | `id: string` | Get user by id |
| `update_user` | `{ id, updateData, requestId? }` | Update user |
| `delete_user` | `id: string` | Delete user |
| `update_location` | `{ id, latitude, longitude }` | Update coordinates + reverse geocode |
| `find_nearby_users` | `{ id, radius }` | Find nearby users |

### Geocoding Service (`api-location`)

| Pattern | Payload | Description |
|---------|---------|-------------|
| `reverse_geocode` | `{ latitude, longitude }` | Resolve coordinates to location label |

### Payment Service (`api-payment`)

| Pattern | Payload | Description |
|---------|---------|-------------|
| `bank-list` | `{}` | VNPay bank list |
| `generate-qr` | custom payload | Generate VNPay QR |
| `generate-url` | custom payload | Build hosted VNPay payment URL |
| `return-url` | custom payload | Verify VNPay return URL data |

### Chatbot Service (`api-chatbot`)

| Pattern | Payload | Description |
|---------|---------|-------------|
| `ask-sse` | `{ prompt }` | Stream answer chunks |
| `ask-strict-sse` | `{ prompt }` | Stream answer constrained by internal docs |
| `upsert-document` | `{ fileName, content, ... }` | Insert/replace document chunks + embeddings |
| `update-document` | `{ id, ... }` | Update document metadata/content |
| `delete-document` | `{ id }` | Delete document |

### Notification Service (`api-notification`)

Events are published on the durable RabbitMQ queue `notifications_queue` (fire-and-forget,
manual ack) and fanned out over the Socket.IO namespace `/notifications`.

| Pattern | Payload | Description |
|---------|---------|-------------|
| `notification.send` | `{ userId, title, message, type?, data? }` | Emit to the `user:{userId}` room |
| `notification.broadcast` | `{ title, message, type?, data? }` | Emit to every connected client |

Clients connect with the user identity in the handshake and listen to the `notification` event:

```js
const socket = io('http://localhost:3005/notifications', { auth: { userId: 'u1' } });
socket.on('notification', (n) => console.log(n));
```

---

## HTTP Endpoints (Gateway)

### User Endpoints

| Method | Path | Proxy Pattern |
|--------|------|---------------|
| `POST` | `/users` | `create_user` |
| `GET` | `/users` | `get_users` |
| `GET` | `/users/:id` | `get_user_by_id` |
| `PUT` | `/users/:id` | `update_user` |
| `DELETE` | `/users/:id` | `delete_user` |
| `PATCH` | `/users/:id/location` | `update_location` |
| `GET` | `/users/:id/nearby?radius=10` | `find_nearby_users` |

### Payment Endpoints

| Method | Path | Proxy Pattern |
|--------|------|---------------|
| `GET` | `/payment/bank-list` | `bank-list` |
| `POST` | `/payment/generate-qr` | `generate-qr` |
| `POST` | `/payment/generate-payment-url` | `generate-url` |
| `POST` | `/payment/generate-return-url` | `return-url` |
| `GET` | `/payment/ipn` | currently returns query payload from gateway |

### Chatbot Endpoints

| Method | Path | Proxy Pattern |
|--------|------|---------------|
| `GET` | `/chatbot/sse?prompt=...` | `ask-sse` |
| `GET` | `/chatbot/strict-sse?prompt=...` | `ask-strict-sse` |

### Notification Endpoints

| Method | Path | Proxy Pattern |
|--------|------|---------------|
| `POST` | `/notifications` | `notification.send` (RabbitMQ event) |
| `POST` | `/notifications/broadcast` | `notification.broadcast` (RabbitMQ event) |

---

## Dependency Injection Example (User Service)

The user module binds abstractions to concrete implementations:

- `UserRepository -> PrismaUserRepository`
- `GEOCODING_SERVICE` TCP client injected for reverse geocoding
- Use-case services registered as providers

This keeps application logic independent of Prisma and transport details.

---

## Inter-Service Communication

Main internal call chain today:

```
Gateway --TCP--> api-user (update_location)
                    |
                    +--TCP--> api-location (reverse_geocode)
                                  |
                                  +--HTTP--> OpenStreetMap Nominatim
```

If geocoding is unavailable, user location updates are designed to degrade gracefully (location name may be null).

---

## Common Commands

```bash
# Start services in watch mode
npm run gateway:dev
npm run user:dev
npm run location:dev
npm run payment:dev
npm run chatbot:dev

# Build individual apps
npm run build:gateway
npm run build:user
npm run build:location
npm run build:payment
npm run build:chatbot

# Unit tests (specs are co-located as *.spec.ts under apps/)
npm test

# Start PostgreSQL
docker compose up -d
```

---

## Environment Variables

| Variable | Default | Used By |
|----------|---------|---------|
| `GATEWAY_PORT` | `3000` | api-gateway |
| `USER_SERVICE_HOST` | `localhost` | api-gateway |
| `USER_SERVICE_PORT` | `3001` | api-gateway, api-user |
| `PAYMENT_SERVICE_HOST` | `localhost` | api-gateway |
| `PAYMENT_SERVICE_PORT` | `3003` | api-gateway, api-payment |
| `CHATBOT_SERVICE_HOST` | `localhost` | api-gateway |
| `CHATBOT_SERVICE_PORT` | `3004` | api-gateway, api-chatbot |
| `NOTIFICATION_SERVICE_PORT` | `3005` | api-notification |
| `RABBITMQ_URL` | `amqp://guest:guest@localhost:5672` | api-gateway, api-notification |
| `NOTIFICATION_QUEUE` | `notifications_queue` | api-gateway, api-notification |
| `LOCATION_SERVICE_PORT` | `3002` | api-user, api-location |
| `HOST_NAME` | (required in current user->location client config) | api-user |
| `DATABASE_URL` | - | services using `@app/database` |
| `GEMINI_API_KEY` | - | api-chatbot |
| `vnp_HashSecret` / `vnp_TmnCode` | - | api-payment |
| `VNPAY_RETURN_URL` / `VNPAY_IP_ADDR` | optional | api-payment |

---

## Benefits

- Independent deployability per service.
- Testable application layer through domain contracts.
- Replaceable infrastructure adapters without rewriting use cases.
- Clear separation of transport, business logic, and integration logic.
- Fault isolation across geocoding, payment, and chatbot concerns.
