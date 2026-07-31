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
│   └── api-chatbot/   # Chatbot + document ingestion service (TCP)
│
├── libs/
│   ├── common/        # Shared constants, DTOs, logger config
│   └── database/      # PrismaService + DatabaseModule + entities
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

Typical folders:
- `domain/repositories` (when persistence abstractions are needed, eg `api-user`)
- `domain/ports` (external adapter contracts, eg geocoding, VNPay, chatbot provider)
- `domain/usecases`

### 2) Application Layer (`application/`)

- Implements use cases with `execute(...)` methods.
- Orchestrates domain contracts and ports.
- Contains service-level workflow logic.

### 3) Infrastructure Layer (`infrastructure/`)

- Provides concrete implementations of domain contracts.
- Uses Prisma (`@app/database`) and external integrations (Nominatim, VNPay, Gemini).

### 4) Presentation Layer (`presentation/`)

- Handles transport concerns (`@MessagePattern` in microservices, HTTP in gateway).
- Maps transport payloads to use case calls.
- Converts errors to transport-specific exceptions.

---

## API Gateway

The gateway is intentionally thin and uses three TCP clients:

- `USER_SERVICE` on `USER_SERVICE_HOST:USER_SERVICE_PORT`
- `PAYMENT_SERVICE` on `PAYMENT_SERVICE_HOST:PAYMENT_SERVICE_PORT`
- `CHATBOT_SERVICE` on `CHATBOT_SERVICE_HOST:CHATBOT_SERVICE_PORT`

Key behaviors:

- Applies global `ValidationPipe` (`whitelist + transform`).
- Uses `CorrelationRequestIdMiddleware` for request correlation.
- Routes HTTP requests to microservices through `ClientProxy.send(...)`.
- Exposes SSE endpoints for chatbot streaming.

---

## Shared Libraries

### `@app/common`

Exports:

- Service tokens: `USER_SERVICE`, `GEOCODING_SERVICE`, `PAYMENT_SERVICE`, `CHATBOT_SERVICE`
- Message pattern groups: `USER_PATTERNS`, `GEOCODING_PATTERNS`, `PAYMENT_PATTERNS`, `CHATBOT_PATTERNS`
- DTOs used by gateway and user service (`CreateUserDto`, `UpdateUserDto`, `UpdateLocationDto`, response DTOs)
- Shared pino logger config (`createPinoHttpConfig`)

### `@app/database`

Exports:

- `PrismaService`
- `DatabaseModule`
- Shared entities/types used across services

### Logging Strategy

- All apps use `nestjs-pino`.
- Service label is set per app (`API-GATEWAY`, `API-USER`, `API-LOCATION`, `API-PAYMENT`, `API-CHATBOT`).
- Request correlation is added in gateway middleware and can be propagated downstream.

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
