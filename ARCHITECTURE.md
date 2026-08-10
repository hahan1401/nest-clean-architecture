# Clean Architecture - NestJS Microservices + Prisma

## High-Level Overview

```
                        ┌─────────────────────────────────────┐
                        │   API Gateway (HTTP :3000, /api)    │
                        │  Validation, correlation id, proxy  │
                        └─────────────────────────────────────┘
                            │                          │
              request/response over TCP        events over RabbitMQ
                            │                          │
        ┌───────────┬───────┴────┬─────────────┐       │
        ▼           ▼            ▼             ▼       │
 ┌────────────┐ ┌─────────┐ ┌──────────┐ ┌──────────┐  │
 │ api-user   │ │api-pay  │ │api-chat  │ │api-book  │  │
 │ :3001      │ │ment     │ │bot :3004 │ │ing :3006 │  │
 │ users,     │ │ :3003   │ │ SSE +    │ │ rooms,   │  │
 │ geo search │ │ VNPay   │ │ RAG docs │ │ tours,   │  │
 └─────┬──────┘ └─────────┘ └────┬─────┘ │ bookings │  │
       │                         │       └────┬─────┘  │
       ▼ TCP                     │            │        │
 ┌────────────┐                  │            │ emails.topic
 │api-location│                  │            └────────┤
 │ :3002      │                  │                     ▼
 │ reverse    │                  │        ┌────────────────────────┐
 │ geocode    │                  │        │ RabbitMQ :5672         │
 └─────┬──────┘                  │        │ emails.topic           │
       │ HTTP                    │        │ notifications.topic    │
       ▼                         │        │ notifications.fanout   │
  Nominatim                      │        └───────┬────────┬───────┘
                                 │                ▼        ▼
                                 │        ┌────────────┐ ┌──────────────┐
                                 │        │ api-email  │ │api-notificat.│
                                 │        │ -> AWS SES │ │ -> Socket.IO │
                                 │        └────────────┘ └──────────────┘
                                 │
        ┌────────────────────────┴───────────────────────┐
        ▼                                                ▼
┌──────────────────┐   streaming replication   ┌──────────────────┐
│ PostgreSQL :5432 │ ────────────────────────> │ replica :5433    │
│ primary (writes) │                           │ (lag-tolerant    │
│ pgvector         │                           │  reads)          │
└──────────────────┘                           └──────────────────┘
```

Only `api-user`, `api-chatbot` and `api-booking` touch the database. Reads that
precede a write are pinned to the primary; browse/history reads go to the replica.

## Repository Layout

```
homestay-booking-be/
├── apps/
│   ├── api-gateway/      # HTTP gateway, fans out to every service
│   ├── api-user/         # User service (TCP)
│   ├── api-location/     # Geocoding service (TCP)
│   ├── api-payment/      # Payment service (TCP, VNPay integration)
│   ├── api-chatbot/      # Chatbot + document ingestion service (TCP)
│   ├── api-notification/ # Real-time notifications (RabbitMQ consumer + Socket.IO)
│   ├── api-email/        # Email sender (RabbitMQ consumer -> AWS SES)
│   └── api-booking/      # Homestay rooms, tours, availability, bookings (TCP)
│
├── libs/
│   ├── common/        # Shared constants, DTOs, error model, filters, logger config
│   ├── database/      # Prisma client factory + DatabaseModule + entities
│   ├── middlewares/   # Correlation request id middleware
│   └── types/         # Shared cross-service types
│
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   └── migrations/
│
├── test/
│   ├── jest-setup.ts  # loads reflect-metadata for DTOs using @Type()
│   └── jest-e2e.json
│
├── docker-compose.yaml   # postgres primary + streaming replica + rabbitmq
├── prisma.config.ts      # loads .env before the Prisma CLI runs
├── nest-cli.json
├── tsconfig.json
└── package.json
```

---

## Apps

| App | Default Port | Transport | Role |
|-----|--------------|-----------|------|
| `api-gateway` | 3000 | HTTP | Entry point, validation, and HTTP-to-TCP/RMQ proxy |
| `api-user` | 3001 | TCP | User CRUD, location update, nearby-user queries |
| `api-location` | 3002 | TCP | Reverse geocoding service |
| `api-payment` | 3003 | TCP | VNPay operations: bank list, QR, payment URL, return verification |
| `api-chatbot` | 3004 | TCP | Streaming chatbot responses and document upsert/update/delete |
| `api-notification` | 3005 | RabbitMQ + Socket.IO | Consumes notification events and pushes them to connected clients |
| `api-email` | — | RabbitMQ | Consumes email events and sends mail via AWS SES |
| `api-booking` | 3006 | TCP (+ RMQ producer) | Rooms, tours, departures, price rules, availability, bookings, daily jobs |

TCP services bootstrap with `NestFactory.createMicroservice`. The two pure RabbitMQ
consumers (`api-notification`, `api-email`) use `NestFactory.createApplicationContext`
instead — `@golevelup/nestjs-rabbitmq` owns the connection, so there is nothing to
`listen()` on.

---

## Clean Architecture Per Service

Every service (`api-user`, `api-location`, `api-payment`, `api-chatbot`,
`api-booking`, `api-notification`, `api-email`) follows the same layered structure:

```
┌──────────────────────────────────────────────────────────┐
│                    Presentation Layer                    │
│   (@MessagePattern controllers, schedulers, modules)     │
├──────────────────────────────────────────────────────────┤
│                    Application Layer                     │
│                 (Use case implementations)               │
├──────────────────────────────────────────────────────────┤
│                      Domain Layer                        │
│            (Ports, contracts, use case APIs)             |
|                zero framework dependencies               │
├──────────────────────────────────────────────────────────┤
│                   Infrastructure Layer                   │
│   (Prisma repos, external adapters: HTTP/VNPay/SES)      │
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
- `domain/repositories` (persistence abstractions, eg `api-user`, `api-booking`)
- `domain/ports` (external adapter contracts, eg geocoding, VNPay, chatbot provider, booking notifier)
- `domain/usecases`
- `domain/models` and `domain/services` (value types and pure functions, eg the booking price calculator)

Repository and port contracts are **abstract classes**, so they double as DI tokens.
Use cases are plain interfaces with a single `execute(...)`.

### 2) Application Layer (`application/`)

- Implements use cases with `execute(...)` methods.
- Orchestrates domain contracts and ports.
- Contains service-level workflow logic.
- Throws `DomainError` subclasses; contains no `try/catch` used purely to remap errors.

### 3) Infrastructure Layer (`infrastructure/`)

- Provides concrete implementations of domain contracts (`extends` the abstract class).
- Uses Prisma (`@app/database`) and external integrations (Nominatim, VNPay, Gemini, SES, RabbitMQ).
- Wraps third-party failures in `DependencyError` so callers stay transport-agnostic.
- Owns retry/timeout/fallback behaviour, including the logging for a swallowed failure.

### 4) Presentation Layer (`presentation/`)

- Handles transport concerns (`@MessagePattern` in microservices, HTTP in gateway,
  `@Cron` in the booking scheduler — a scheduler is an inbound adapter like a controller).
- Maps transport payloads to use case calls, and entities to response DTOs.
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

> **The TCP envelope is nested.** Nest serializes an `RpcException` carrying an object as
> `{ error: { code, status, message }, message }`, so the code sits one level down.
> `normalizeError()` unwraps that `error` property first; without it every microservice
> 404/409 arrives at the gateway as a 500 with the right message and the wrong status.
> `libs/common/src/errors/normalize.spec.ts` pins this shape.

Rules of thumb:

- Never import `@nestjs/common` exceptions in `domain/` or `application/`.
- Only catch an error if you add context or a fallback; otherwise let it bubble to the filter.
- Unexpected errors are logged with a stack trace but returned to clients as a generic 500.

---

## API Gateway

The gateway is intentionally thin. It holds four TCP clients and three RabbitMQ clients:

| Token | Transport | Target |
|-------|-----------|--------|
| `USER_SERVICE` | TCP | `USER_SERVICE_HOST:USER_SERVICE_PORT` |
| `PAYMENT_SERVICE` | TCP | `PAYMENT_SERVICE_HOST:PAYMENT_SERVICE_PORT` |
| `CHATBOT_SERVICE` | TCP | `CHATBOT_SERVICE_HOST:CHATBOT_SERVICE_PORT` |
| `BOOKING_SERVICE` | TCP | `BOOKING_SERVICE_HOST:BOOKING_SERVICE_PORT` |
| `EMAIL_SERVICE` | RMQ | `emails.topic` (topic, `wildcards: true`) |
| `NOTIFICATION_SERVICE` | RMQ | `notifications.topic` (topic, `wildcards: true`) |
| `NOTIFICATION_BROADCAST_SERVICE` | RMQ | `notifications.fanout` (fanout) |

Key behaviors:

- Applies global `ValidationPipe` (`whitelist + transform`).
- Applies `app.setGlobalPrefix('api')` — **every controller route is served under `/api`**.
- Uses `CorrelationRequestIdMiddleware` for request correlation.
- Registers `AllExceptionsHttpFilter` and `LoggingInterceptor` globally.
- Routes request/response calls through `lastValueFrom(client.send(...))` and
  fire-and-forget events through `client.emit(...)` with `202 Accepted`.
- Exposes SSE endpoints for chatbot streaming, and proxies `/socket.io` to api-notification.

> **The global prefix does not cover `/socket.io`.** The proxy is raw Express middleware
> mounted with `app.use('/socket.io', ...)` before `setGlobalPrefix`, and the `upgrade`
> handler matches on the literal `/socket.io/` prefix. Socket.IO therefore stays at the
> **origin root** — `http://localhost:3000/socket.io`, *not* `/api/socket.io`. Anything
> declared in a controller is prefixed; anything mounted as middleware is not.

> **Route ordering matters.** Literal segments must be declared before parameterised ones —
> `@Get('availability')` above `@Get(':id')`, or `/rooms/availability` resolves to a room
> whose id is `"availability"`.

---

## Shared Libraries

### `@app/common`

Exports (all re-exported from `libs/common/src/index.ts`):

- **Service tokens** (`constants/services.ts`): `USER_SERVICE`, `GEOCODING_SERVICE`,
  `PAYMENT_SERVICE`, `CHATBOT_SERVICE`, `NOTIFICATION_SERVICE`,
  `NOTIFICATION_BROADCAST_SERVICE`, `EMAIL_SERVICE`, `BOOKING_SERVICE`
- **Message pattern groups** (`constants/message-patterns.ts`): `USER_PATTERNS`,
  `GEOCODING_PATTERNS`, `PAYMENT_PATTERNS`, `CHATBOT_PATTERNS`, `NOTIFICATION_PATTERNS`,
  `EMAIL_PATTERNS`, `BOOKING_PATTERNS`
- **Queues and exchanges** (`constants/queues.ts`): `NOTIFICATION_QUEUE`,
  `NOTIFICATION_EXCHANGE`, `NOTIFICATION_BROADCAST_EXCHANGE`,
  `NOTIFICATION_BROADCAST_QUEUE_PREFIX`, `EMAIL_EXCHANGE`, `EMAIL_QUEUE`,
  `RABBITMQ_DEFAULT_URL`
- **DTOs**: user (`CreateUserDto`, `UpdateUserDto`, `UpdateLocationDto`, response DTOs),
  notification, email (`SendEmailDto`), and booking
  (`booking-input.dto`, `booking-query.dto`, `booking-response.dto`)
- **Error model**: `DomainError` hierarchy, `ErrorCode`, `HTTP_STATUS_BY_CODE`, `normalizeError`
- **Boundary filters**: `AllExceptionsHttpFilter`, `AllExceptionsRpcFilter`
- **Logging**: `createPinoHttpConfig`, `LoggingInterceptor`
- **Types**: `CorrelatedRequest`

Any DTO the gateway validates must live here, because the gateway and the owning service
both reference it.

### `@app/database`

Exports:

- `PRISMA_SERVICE` — a `Symbol` DI token. The client is built with `$extends()`, which
  returns a plain object rather than a `PrismaClient` subclass, so it **cannot** be
  injected as a class. Always
  `@Inject(PRISMA_SERVICE) private readonly prisma: ExtendedPrismaClient`.
- `createPrismaClient()` / `parseReplicaUrls()` — build the pooled `PrismaPg` adapters and
  attach `@prisma/extension-read-replicas`.
- `ExtendedPrismaClient`, `ExtendedTransactionClient` types.
- `DatabaseModule` — `@Global()`, connects on boot and `$disconnect()`s on shutdown.
- Entities as plain classes with `constructor(partial)`: `User`, `UserWithDistance`,
  `Room`, `Tour`, `TourDeparture`, `AvailableDeparture`, `PriceRule`, `Booking`,
  `BookingLine`, `PriceQuote`, `PriceQuoteLine`, plus the Prisma enums
  (`BookingStatus`, `BookableType`, `DepartureStatus`, `PriceSource`) re-exported so no
  app imports `@prisma/client` directly.

#### Read replica routing

`DATABASE_REPLICA_URLS` is a comma-separated list; when empty the primary stands in as its
own replica so the client keeps one shape across environments.

- Model operations (`prisma.room.findMany`) auto-route reads to a replica.
- `$queryRaw` / `$queryRawUnsafe` / `$executeRaw*` are **not** auto-routed — pick the role
  explicitly with `$primary()` or `$replica()`.
- `$transaction` always runs on the primary.

Rule of thumb: a read that immediately precedes a write goes to `$primary()` (replication
lag would decide on stale state); browse, search and history reads go to `$replica()`.

### Logging Strategy

`nestjs-pino` is the only logging implementation — the NestJS built-in `Logger` is not used
anywhere, including during bootstrap.

- Every app registers `LoggerModule.forRoot({ pinoHttp: createPinoHttpConfig('<SERVICE>') })`
  with its own label: `API-GATEWAY`, `API-USER`, `API-LOCATION`, `API-PAYMENT`,
  `API-CHATBOT`, `API-NOTIFICATION`, `API-EMAIL`, `API-BOOKING`.
- Bootstrap uses `bufferLogs: true` + `app.flushLogs()` so Nest's own startup output is
  replayed through pino instead of the default console logger.
- Classes inject `PinoLogger` and call `setContext(...)`; log calls use pino's
  `(mergingObject, message)` signature so fields stay structured.
- `LoggingInterceptor` is registered globally (`APP_INTERCEPTOR`) in every app and records
  request start / completed / failed together with the duration, for both HTTP and RPC.
- Sensitive fields (`password`, `authorization`, `vnp_HashSecret`) are redacted by the shared
  pino config. Credentials that live in a **URL path** rather than a property — currently
  `/bookings/cancel/:token` — cannot be reached by `redact.paths` and are masked by the
  `req` serializer instead.

> ⚠️ **The `/api` global prefix breaks this masking.** `CREDENTIAL_PATH_PREFIXES` in
> `libs/common/src/logger/pino-http.config.ts` is matched with `url.startsWith(...)` against
> the raw request URL. The gateway now receives `/api/bookings/cancel/<token>`, which does not
> start with `/bookings/cancel/`, so the cancellation token is currently logged in plaintext.
> The prefix list has to gain the `/api` form (or the match has to become substring-based).

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

### Booking Service (`api-booking`)

Catalogue and availability:

| Pattern | Payload | Description |
|---------|---------|-------------|
| `create_room` / `list_rooms` / `get_room` | room DTO / filter / `{ id }` | Room catalogue |
| `get_room_by_code` | `{ code }` | One room by its unique human-readable `code` |
| `search_available_rooms` | `{ from, to, guests?, skip?, take? }` | Free rooms for a window, each with a quote |
| `check_room_availability` | `{ roomId, from, to }` | One room: available plus its quote |
| `list_room_bookings` | `{ roomId, status?, from?, to? }` | Full booking history for a room |
| `create_tour` / `list_tours` / `get_tour` | tour DTO / filter / `{ id }` | Tour catalogue |
| `get_tour_by_slug` | `{ slug }` | One tour by its unique `slug` |
| `create_tour_departure` / `list_tour_departures` | `{ tourId, ... }` | Dated, seat-capped departures |
| `search_available_departures` | `{ from, to, seats, tourId? }` | Departures with enough seats left |
| `check_tour_availability` | `{ tourId, from, to, seats }` | Same, narrowed to one tour |
| `list_tour_bookings` | `{ tourId, status?, from?, to? }` | Booking history across a tour's departures |
| `create_price_rule` / `list_price_rules` / `delete_price_rule` | rule DTO / filter / `{ id }` | Price overrides |
| `quote_price` | `{ type, ... }` | Price a stay or seat block without booking |

Bookings and self-service cancellation:

| Pattern | Payload | Description |
|---------|---------|-------------|
| `create_booking` | `{ type, ..., guests, customer }` | Creates a `PENDING` hold |
| `confirm_booking` | `{ bookingId }` | `PENDING -> CONFIRMED`, then fires both emails |
| `cancel_booking` | `{ bookingId, reason? }` | Staff-side cancellation |
| `get_booking` / `get_booking_by_reference` | `{ id }` / `{ reference }` | Look up a booking |
| `get_booking_by_cancellation_token` | `{ token }` | **Read-only** lookup behind the emailed link |
| `cancel_booking_by_token` | `{ token, reason? }` | Customer-side cancellation |

Maintenance jobs, driven by `BookingMaintenanceScheduler` (`@nestjs/schedule`) and also
callable as patterns for manual re-runs:

| Pattern | Schedule | Effect |
|---------|----------|--------|
| `expire_stale_holds` | `HOLD_SWEEP_CRON` | `PENDING` past its hold → `EXPIRED`, returning its seats |
| `close_elapsed_departures` | `DAILY_MAINTENANCE_CRON` | past `OPEN` departures → `CLOSED` |
| `complete_elapsed_bookings` | `DAILY_MAINTENANCE_CRON` | elapsed `CONFIRMED` → `COMPLETED` |

Each is a single atomic conditional statement, so every replica can run its own cron
safely — a second concurrent run simply matches zero rows and reports `{ affected: 0 }`.

### Email Service (`api-email`)

| Pattern | Exchange | Payload | Description |
|---------|----------|---------|-------------|
| `email.send` | `emails.topic` | `SendEmailDto` | Sends via AWS SES; `from` falls back to `EMAIL_FROM` |

### Notification Service (`api-notification`)

Two RabbitMQ topologies feed the same Socket.IO namespace `/notifications`:

| Exchange | Type | Queue | Delivery |
|----------|------|-------|----------|
| `notifications.topic` | topic | `notifications_queue` (durable, shared) | Routing key = message pattern; replicas compete, each event handled once |
| `notifications.fanout` | fanout | `notifications.broadcast.<uuid>` (exclusive, auto-delete, one per instance) | Every replica receives the event and pushes to its own sockets |

Messages are consumed with manual acknowledgement; a payload that fails is nacked without requeue.

| Pattern | Exchange | Payload | Description |
|---------|----------|---------|-------------|
| `notification.send` | topic | `{ userId, title, message, type?, data? }` | Emit to the `user:{userId}` room |
| `notification.broadcast` | fanout | `{ title, message, type?, data? }` | Emit to every connected client |

Clients connect with the user identity in the handshake and listen to the `notification` event:

```js
const socket = io('http://localhost:3005/notifications', { auth: { userId: 'u1' } });
socket.on('notification', (n) => console.log(n));
```

---

## HTTP Endpoints (Gateway)

> **All paths below are relative to the `/api` global prefix.** `POST /users` is served at
> `POST /api/users`, `GET /rooms/availability` at `GET /api/rooms/availability`, and so on.
> The tables keep the controller-relative form because that is what the `@Controller()`
> decorators declare. The single exception is the Socket.IO proxy, which stays at `/socket.io`.

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

### Notification / Email Endpoints

| Method | Path | Proxy Pattern |
|--------|------|---------------|
| `POST` | `/notifications` | `notification.send` (RabbitMQ event, 202) |
| `POST` | `/notifications/broadcast` | `notification.broadcast` (RabbitMQ event, 202) |
| `POST` | `/emails` | `email.send` (RabbitMQ event, 202) |

### Booking Endpoints

Catalogue and availability:

| Method | Path | Proxy Pattern |
|--------|------|---------------|
| `POST` / `GET` | `/rooms` | `create_room` / `list_rooms` |
| `GET` | `/rooms/availability?from&to&guests` | `search_available_rooms` |
| `GET` | `/rooms/code/:code` | `get_room_by_code` |
| `GET` | `/rooms/:id` | `get_room` |
| `GET` | `/rooms/:id/availability?from&to` | `check_room_availability` |
| `GET` | `/rooms/:id/bookings?status&from&to` | `list_room_bookings` |
| `POST` / `GET` | `/tours` | `create_tour` / `list_tours` |
| `GET` | `/tours/availability?from&to&seats` | `search_available_departures` |
| `GET` | `/tours/slug/:slug` | `get_tour_by_slug` |
| `GET` | `/tours/:id` | `get_tour` |
| `POST` / `GET` | `/tours/:id/departures` | `create_tour_departure` / `list_tour_departures` |
| `GET` | `/tours/:id/availability?from&to&seats` | `check_tour_availability` |
| `GET` | `/tours/:id/bookings` | `list_tour_bookings` |
| `POST` / `GET` | `/price-rules` | `create_price_rule` / `list_price_rules` |
| `DELETE` | `/price-rules/:id` | `delete_price_rule` |

Bookings:

| Method | Path | Proxy Pattern |
|--------|------|---------------|
| `POST` | `/bookings/quote` | `quote_price` |
| `POST` | `/bookings` | `create_booking` (creates a `PENDING` hold) |
| `GET` | `/bookings/:id` | `get_booking` |
| `GET` | `/bookings/reference/:reference` | `get_booking_by_reference` |
| `POST` | `/bookings/:id/confirm` | `confirm_booking` (fires both emails) |
| `POST` | `/bookings/:id/cancel` | `cancel_booking` |
| `GET` | `/bookings/cancel/:token` | `get_booking_by_cancellation_token` — **read-only** |
| `POST` | `/bookings/cancel/:token` | `cancel_booking_by_token` |

---

## Booking Domain

### Data model

```
Room ─┬─< Booking >─┬─ TourDeparture >─ Tour
      │      │      │
      │      └─< BookingLine >─ PriceRule
      └─< PriceRule ─────────────┘
```

| Table | Purpose |
|-------|---------|
| `rooms` | Bookable rooms with `max_guests` and a nightly `base_price` |
| `tours` | Tour products with a per-person base price |
| `tour_departures` | Dated instances of a tour: `capacity`, `booked_seats`, optional `price_override` |
| `price_rules` | Overrides for exactly one room **or** tour, over a date window and/or weekday set |
| `bookings` | One row per booking; ROOM rows carry `check_in`/`check_out`, TOUR rows carry `seats` |
| `booking_lines` | The frozen price breakdown — one row per stay night, or one per tour booking |

Money is a whole number of **VND** in `Int` columns. VND has no minor unit, so there is no
scaling factor anywhere; `Int` stays exact, JSON-serialisable over TCP, and usable directly
in `CHECK` constraints.

Lifecycle: `PENDING` → `CONFIRMED` → `COMPLETED`, with `CANCELLED` and `EXPIRED` as the
releasing terminals. `PENDING`, `CONFIRMED` and `COMPLETED` all hold a slot.

### Invariants enforced by the database

Neither guarantee depends on application code being correct:

- **Rooms** use a Postgres `EXCLUDE USING gist` constraint (`bookings_room_no_overlap`,
  requires the `btree_gist` extension) over `room_id` + `daterange(check_in, check_out, '[)')`,
  restricted to slot-holding statuses. The half-open range makes same-day turnover legal —
  a checkout and a check-in on the same date do not collide. Cancelling drops the row out of
  the partial index, freeing the dates atomically with no compensating write. A losing insert
  raises `23P01`, which the repository maps to a `ConflictError` (Prisma has no mapped code
  for exclusion violations, so it matches on the constraint name).
- **Tour departures** use a conditional `UPDATE` on the `booked_seats` counter, backed by
  `tour_departures_seats_check`. This is correct at READ COMMITTED without `FOR UPDATE` and
  without a retry loop: the loser blocks on the row lock, and when the winner commits
  Postgres re-evaluates the `WHERE` against the new row version, so the loser matches nothing.

A `SELECT ... FOR UPDATE` over overlapping bookings would **not** work — a query returning
zero rows locks nothing, so two concurrent requests would both see "free" and both insert.

### Pricing

Resolution order is deterministic, because the result gets frozen: explicit `priority`,
then specificity, then the narrower window, then recency and id. For tours the chain is
departure `price_override` → winning `PriceRule` → tour base price, recorded per line in
`price_source`.

The winner is chosen by a **pure function** in `domain/services/price-calculator.ts`, and the
result is written to `booking_lines` alongside `bookings.total_amount` from the same in-memory
quote — so the two cannot diverge, and later price edits never rewrite history.

> Calendar dates are `@db.Date` and materialise as **UTC midnight**. Build them from
> date-only ISO strings (`new Date('2027-02-14')`) and read the weekday with `getUTCDay()`,
> which matches Postgres `EXTRACT(DOW)`. `new Date(2027, 1, 14)` is local time and shifts the
> night by one outside UTC.

### Confirmation emails and the cancel link

`ConfirmBookingService` commits the status transition **before** the broker is touched, and
the transition itself is the idempotency guard, so a replayed confirm returns 409 and sends
no second email. Delivery is best effort: `BookingNotifierPort` is contractually forbidden
from throwing, and its RMQ adapter bounds every publish with a timeout — `ClientProxy.emit()`
begins with a `connect()`, and `amqp-connection-manager` retries a dead broker forever, so
without that timeout a RabbitMQ outage would hang the whole RPC call.

The customer's email carries `PUBLIC_BASE_URL/bookings/cancel/<token>`, where the token is 32
random bytes. The owner's email deliberately does **not** — forwarding it would hand over the
cancellation credential. The token never appears in an API response.

> ⚠️ **`PUBLIC_BASE_URL` is not prefix-aware.** `ConfirmBookingService` appends the literal
> `/bookings/cancel/<token>`, so it must name the **frontend** origin — now
> `http://localhost:4000`, where `/bookings/cancel/<token>` is a real page that renders the
> booking and only cancels on a button press. Pointing it at the gateway mails out a raw JSON
> URL (and with the `/api` prefix, a `404` unless you also append `/api`).

> The `GET` half of the cancel route **must stay side-effect free.** Mail clients, corporate
> scanners and link-preview bots fetch every URL in a message, so a state-changing `GET` would
> cancel bookings nobody clicked. `GET` renders the confirmation page; `POST` does the work.

### Migration footgun

`bookings_room_no_overlap` creates a GiST index that appears in `pg_index` but not in the
Prisma schema, so **every** later `prisma migrate dev` emits a `DROP` for it. Delete that
line by hand, exactly as with the pre-existing `ivfflat` index. This is documented in the
`20260808150946_add_booking_domain` migration header.

The sharper edge is that Prisma models neither `CHECK` nor `EXCLUDE`, and Postgres silently
drops any constraint mentioning a column that gets dropped — which is what a column *retype*
is under the hood. `20260810082416_use_int_autoincrement_ids` retyped `room_id`, `tour_id` and
`tour_departure_id`, and would have taken `bookings_shape_check`, `bookings_room_no_overlap`
and `price_rules_target_check` with them; that migration drops and recreates all three by
hand. After any migration that touches those columns, check the constraints are still there:

```sql
SELECT conrelid::regclass, conname FROM pg_constraint
WHERE connamespace = 'public'::regnamespace AND contype IN ('c', 'x') ORDER BY 1, 2;
```

---

## Dependency Injection Example (User Service)

The user module binds abstractions to concrete implementations:

- `UserRepository -> PrismaUserRepository`
- `GEOCODING_SERVICE` TCP client injected for reverse geocoding
- Use-case services registered as providers

This keeps application logic independent of Prisma and transport details.

---

## Inter-Service Communication

Main internal call chains today:

```
Gateway --TCP--> api-user (update_location)
                    |
                    +--TCP--> api-location (reverse_geocode)
                                  |
                                  +--HTTP--> OpenStreetMap Nominatim

Gateway --TCP--> api-booking (confirm_booking)
                    |
                    +--RMQ(emails.topic)--> api-email --SES--> owner + customer

Gateway --RMQ(notifications.*)--> api-notification --Socket.IO--> browsers
```

If geocoding is unavailable, user location updates are designed to degrade gracefully
(location name may be null).

`api-booking` is the first non-gateway service to publish over RabbitMQ. Two details are
load-bearing when adding another producer:

- Register the client with `ClientsModule.registerAsync` + `ConfigService`, not `register` +
  `process.env`. The `@Module` decorator argument is evaluated at require time, before
  `main.ts` loads `.env.local`; the gateway only gets away with it because of its default URL.
- `wildcards: true` is required on a topic exchange. `ClientRMQ.dispatchEvent` only calls
  `channel.publish(exchange, routingKey)` on that branch — without it it calls
  `sendToQueue(undefined)` and the message silently vanishes.

---

## Testing

- Specs are co-located as `*.spec.ts` under `apps/` and `libs/` (both are in `jest.roots`).
- Application services are constructed directly with hand-rolled `jest.Mocked<Port>` objects —
  **no `Test.createTestingModule`**. Cover at least one happy path and one failure path.
- Pure domain functions (price calculator, bounding box, email templates) are tested directly.
- `test/jest-setup.ts` imports `reflect-metadata`, which Nest loads at runtime but jest does
  not; DTOs using class-transformer's `@Type()` need it at decoration time.

---

## Common Commands

```bash
# Start services in watch mode
npm run gateway:dev
npm run user:dev
npm run location:dev
npm run payment:dev
npm run chatbot:dev
npm run booking:dev
npm run notification:dev
npm run email:dev

# Build individual apps
npm run build:gateway
npm run build:user
npm run build:location
npm run build:payment
npm run build:chatbot
npm run build:booking
npm run build:notification
npm run build:email

# Unit tests (specs are co-located as *.spec.ts under apps/ and libs/)
npm test

# Start PostgreSQL primary + replica and RabbitMQ
docker compose up -d

# Database workflow
npx prisma migrate dev --name <short_snake_case> --create-only   # then hand-edit raw SQL
npx prisma migrate dev          # apply
npx prisma generate
npx prisma db seed
npx prisma migrate deploy       # CI / production - never `migrate dev`

# Verification gate before committing
npx tsc --noEmit && npx eslint "apps/**/*.ts" "libs/**/*.ts" && npx jest
```

---

## Environment Variables

| Variable | Default | Used By |
|----------|---------|---------|
| `GATEWAY_PORT` | `3000` | api-gateway (routes served under the `/api` prefix) |
| `USER_SERVICE_HOST` | `localhost` | api-gateway |
| `USER_SERVICE_PORT` | `3001` | api-gateway, api-user |
| `LOCATION_SERVICE_PORT` | `3002` | api-user, api-location |
| `PAYMENT_SERVICE_HOST` | `localhost` | api-gateway |
| `PAYMENT_SERVICE_PORT` | `3003` | api-gateway, api-payment |
| `CHATBOT_SERVICE_HOST` | `localhost` | api-gateway |
| `CHATBOT_SERVICE_PORT` | `3004` | api-gateway, api-chatbot |
| `NOTIFICATION_SERVICE_PORT` | `3005` | api-notification, gateway socket proxy |
| `BOOKING_SERVICE_HOST` | `localhost` | api-gateway |
| `BOOKING_SERVICE_PORT` | `3006` | api-gateway, api-booking |
| `HOST_NAME` | (required in current user->location client config) | api-user |
| `RABBITMQ_URL` | `amqp://guest:guest@localhost:5672` | api-gateway, api-notification, api-email, api-booking |
| `NOTIFICATION_QUEUE` | `notifications_queue` | api-gateway, api-notification |
| `DATABASE_URL` | - | services using `@app/database` |
| `DATABASE_REPLICA_URLS` | empty (primary serves reads) | services using `@app/database` |
| `DB_POOL_MAX` / `DB_REPLICA_POOL_MAX` | `10` | `@app/database` connection pools |
| `DB_CONNECTION_TIMEOUT_MS` | `5000` | `@app/database` |
| `DB_IDLE_TIMEOUT_MS` | `30000` | `@app/database` |
| `DB_STATEMENT_TIMEOUT_MS` | `10000` | `@app/database` |
| `SERVICE_NAME` | `nest-app` | `application_name` in `pg_stat_activity` |
| `LOG_LEVEL` | `info` | every app |
| `GEMINI_API_KEY` | - | api-chatbot |
| `EMAIL_FROM` | - (required) | api-email (fallback sender; api-booking leaves `from` unset) |
| `AWS_SES_REGION` / `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | - | api-email |
| `HOMESTAY_OWNER_EMAIL` | - (required) | api-booking |
| `PUBLIC_BASE_URL` | `http://localhost:4000` | api-booking (builds the emailed cancel link; must be the **frontend** origin, not the gateway) |
| `EMAIL_EMIT_TIMEOUT_MS` | `2000` | api-booking |
| `BOOKING_HOLD_TTL_MINUTES` | `30` | api-booking |
| `HOLD_SWEEP_CRON` | `*/10 * * * *` | api-booking |
| `DAILY_MAINTENANCE_CRON` | `5 0 * * *` | api-booking |
| `vnp_HashSecret` / `vnp_TmnCode` | - | api-payment |
| `VNPAY_RETURN_URL` / `VNPAY_IP_ADDR` | optional | api-payment |

---

## Benefits

- Independent deployability per service.
- Testable application layer through domain contracts — every use case is constructible
  with plain mocks, no Nest testing module required.
- Replaceable infrastructure adapters without rewriting use cases (swap SES for SMTP, or
  RabbitMQ for SNS, by changing one adapter).
- Clear separation of transport, business logic, and integration logic.
- Fault isolation across geocoding, payment, chatbot, and booking concerns.
- Correctness guarantees that survive bugs: booking invariants live in Postgres constraints,
  so no code path — including a migration, a seed script, or a `psql` session — can oversell
  a room or a departure.
