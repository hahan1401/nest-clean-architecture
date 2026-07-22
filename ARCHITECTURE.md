# Clean Architecture - NestJS Microservices + Prisma

## High-Level Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          API Gateway (HTTP :3000)                            │
│                   Validates requests, proxies to services via TCP            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                    │                                         │
│                    ┌───────────────┴───────────────┐                         │
│                    ▼                               ▼                         │
│   ┌───────────────────────────┐   ┌───────────────────────────┐            │
│   │   api-user (TCP :3001)    │   │ api-location (TCP :3002)  │            │
│   │ User CRUD + location ops  │──▶│  Geocoding (reverseGeocode│            │
│   └───────────────────────────┘   └───────────────────────────┘            │
│                    │                               │                         │
│                    └───────────────┬───────────────┘                         │
│                                    ▼                                         │
│                         ┌───────────────────┐                               │
│                         │   PostgreSQL DB    │                               │
│                         └───────────────────┘                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Repository Layout

```
nest-clean-architecture/
├── apps/
│   ├── api-gateway/              # HTTP entry point (port 3000)
│   │   └── src/
│   │       ├── main.ts
│   │       ├── app.module.ts
│   │       └── controllers/
│   │           ├── user.controller.ts
│   │           └── location.controller.ts
│   │
│   ├── api-user/                 # User microservice (TCP port 3001)
│   │   └── src/
│   │       ├── main.ts
│   │       ├── app.module.ts
│   │       ├── domain/
│   │       │   ├── repositories/user.repository.ts
│   │       │   └── usecases/
│   │       ├── application/
│   │       │   └── usecases/
│   │       ├── infrastructure/
│   │       │   └── repositories/prisma-user.repository.ts
│   │       └── presentation/
│   │           ├── controllers/user.controller.ts
│   │           └── modules/user.module.ts
│   │
│   └── api-location/             # Location microservice (TCP port 3002)
│       └── src/
│           ├── main.ts
│           ├── app.module.ts
│           ├── domain/
│           │   ├── ports/geocoding.port.ts
│           │   ├── repositories/location.repository.ts
│           │   └── usecases/
│           ├── application/
│           │   └── usecases/
│           ├── infrastructure/
│           │   ├── repositories/prisma-location.repository.ts
│           │   └── services/nominatim-geocoding.service.ts
│           └── presentation/
│               ├── controllers/location.controller.ts
│               └── modules/location.module.ts
│
├── libs/
│   ├── common/                   # @app/common — shared constants & DTOs
│   │   └── src/
│   │       ├── constants/
│   │       │   ├── message-patterns.ts
│   │       │   └── services.ts
│   │       ├── dtos/
│   │       │   ├── create-user.dto.ts
│   │       │   ├── update-user.dto.ts
│   │       │   ├── update-location.dto.ts
│   │       │   └── user-response.dto.ts
│   │       └── index.ts
│   │
│   └── database/                 # @app/database — Prisma & shared entities
│       └── src/
│           ├── prisma.service.ts
│           ├── database.module.ts
│           ├── entities/user.entity.ts
│           └── index.ts
│
├── prisma/
│   └── schema.prisma
├── nest-cli.json
├── tsconfig.json
└── package.json
```

---

## Apps

| App | Port | Transport | Role |
|-----|------|-----------|------|
| `api-gateway` | 3000 | HTTP | Entry point; validates requests, proxies to microservices via TCP |
| `api-user` | 3001 | TCP | User CRUD + location update & nearby-user queries |
| `api-location` | 3002 | TCP | Pure geocoding service (reverse geocode only) |

---

## Clean Architecture Per Service

Each microservice (`api-user`, `api-location`) follows the same layered architecture internally:

```
┌──────────────────────────────────────────────────────────┐
│                    Presentation Layer                     │
│          (@MessagePattern controllers, Modules)          │
├──────────────────────────────────────────────────────────┤
│                    Application Layer                      │
│                (Use Cases / Services)                     │
├──────────────────────────────────────────────────────────┤
│                      Domain Layer                         │
│      (Repository Contracts, Port Interfaces, Use Case    │
│       Interfaces) — zero framework dependencies          │
├──────────────────────────────────────────────────────────┤
│                   Infrastructure Layer                    │
│     (Prisma Repositories, External Service Adapters)     │
└──────────────────────────────────────────────────────────┘
```

### Dependency Rule

```
Presentation → Application → Domain ← Infrastructure
```

Dependencies point **inward only**. Outer layers know about inner layers, but inner layers never reference outer layers.

---

## Layers (within each microservice)

### 1. Domain Layer (`domain/`)

The **innermost layer** — pure business logic with **zero external dependencies**.

| Folder | Purpose |
|--------|---------|
| `repositories/` | Abstract contracts (abstract classes) defining data operations |
| `ports/` | Abstract contracts for external services (e.g., geocoding) |
| `usecases/` | Interfaces describing application-level operations |

**Rules:**
- No imports from any other layer or external library
- No framework decorators
- Pure TypeScript classes and interfaces

---

### 2. Application Layer (`application/`)

Contains **application-specific business rules** — orchestrates flow between presentation and domain.

| Folder | Purpose |
|--------|---------|
| `usecases/` | Service classes implementing workflows (one `execute` method each) |

**Rules:**
- Depends only on the Domain layer
- Uses NestJS `@Injectable()` for DI
- Receives abstract contracts via constructor injection
- Throws domain-relevant exceptions

---

### 3. Infrastructure Layer (`infrastructure/`)

Contains **concrete implementations** of domain abstractions.

| Folder | Purpose |
|--------|---------|
| `repositories/` | Prisma-based repository implementations |
| `services/` | External service adapters (e.g., Nominatim geocoding) |

**Rules:**
- Implements abstract classes from the Domain layer
- Imports `PrismaService` from `@app/database`
- Can be swapped without affecting business logic

---

### 4. Presentation Layer (`presentation/`)

The **outermost layer** — handles TCP message patterns and wires everything via NestJS modules.

| Folder | Purpose |
|--------|---------|
| `controllers/` | `@MessagePattern` handlers that delegate to use case services |
| `modules/` | NestJS modules binding abstract contracts to concrete implementations |

**Rules:**
- Translates incoming TCP messages into use case calls
- Wraps exceptions as `RpcException` for transport
- Binds abstractions to implementations in module providers

---

## API Gateway

The gateway is a **thin HTTP proxy** — no clean architecture layers needed.

- Registers `ClientsModule` with a single TCP connection to `api-user`
- All HTTP routes (including `/users/:id/location` and `/users/:id/nearby`) proxy through `USER_SERVICE`
- HTTP controllers forward requests via `ClientProxy.send(pattern, data)`
- Applies `ValidationPipe` globally for request validation using shared DTOs from `@app/common`
- Catches `RpcException` responses and re-throws as `HttpException`

---

## Shared Libraries

### `@app/common`

| Export | Purpose |
|--------|---------|
| `USER_PATTERNS` | Message pattern constants for user service (incl. `UPDATE_LOCATION`, `FIND_NEARBY_USERS`) |
| `GEOCODING_PATTERNS` | Message pattern constants for geocoding service (`REVERSE_GEOCODE`) |
| `USER_SERVICE` / `GEOCODING_SERVICE` | ClientProxy injection tokens |
| `CreateUserDto` / `UpdateUserDto` / `UpdateLocationDto` | Request DTOs with `class-validator` decorators |
| `UserResponseDto` / `UserWithDistanceResponseDto` | Response DTOs |

### `@app/database`

| Export | Purpose |
|--------|---------|
| `PrismaService` | Prisma client lifecycle management |
| `DatabaseModule` | Global module providing `PrismaService` |
| `User` / `UserWithDistance` | Domain entity classes (shared since both services operate on same table) |

### Logging Strategy

- Every app uses a shared `nestjs-pino` HTTP config from `libs/common/src/logger`.
- Logs are structured in production and pretty-printed only outside production for local development.
- The gateway adds a generated `requestId` to each incoming request and the value is included in serialized logs and downstream payloads where needed.
- Each app uses its own service label in the log message prefix so traces are easy to scan across services.
- Prefer explicit domain or workflow logs over noisy automatic request logging.

---

## Message Patterns

### User Service (api-user)

| Pattern | Payload | Description |
|---------|---------|-------------|
| `create_user` | `{ name, email, password }` | Create a new user |
| `get_users` | `{}` | Get all users |
| `get_user_by_id` | `id: string` | Get user by ID |
| `update_user` | `{ id, updateData }` | Update user fields |
| `delete_user` | `id: string` | Delete user |
| `update_location` | `{ id, latitude, longitude }` | Update user location (calls geocoding service internally) |
| `find_nearby_users` | `{ id, radius }` | Find users within radius (km) |

### Geocoding Service (api-location)

| Pattern | Payload | Description |
|---------|---------|-------------|
| `reverse_geocode` | `{ latitude, longitude }` | Resolve coordinates to a human-readable location name |

---

## API Endpoints (via api-gateway)

| Method | Path | Proxies To | Description |
|--------|------|-----------|-------------|
| `POST` | `/users` | `api-user` → `create_user` | Create user |
| `GET` | `/users` | `api-user` → `get_users` | List all users |
| `GET` | `/users/:id` | `api-user` → `get_user_by_id` | Get user by ID |
| `PUT` | `/users/:id` | `api-user` → `update_user` | Update user |
| `DELETE` | `/users/:id` | `api-user` → `delete_user` | Delete user |
| `PATCH` | `/users/:id/location` | `api-user` → `update_location` | Update location |
| `GET` | `/users/:id/nearby` | `api-user` → `find_nearby_users` | Find nearby users |

---

## How Dependency Injection Connects the Layers

In `apps/api-user/src/presentation/modules/user.module.ts`:

```typescript
@Module({
  imports: [
    DatabaseModule,
    ClientsModule.register([{ name: GEOCODING_SERVICE, transport: Transport.TCP, ... }]),
  ],
  controllers: [UserController],
  providers: [
    { provide: UserRepository, useClass: PrismaUserRepository },
    CreateUserService,
    GetUsersService,
    GetUserByIdService,
    UpdateUserService,
    DeleteUserService,
    UpdateLocationService,
    FindNearbyUsersService,
  ],
})
export class UserModule {}
```

The Application layer injects `UserRepository` (abstract) — it never knows about Prisma. The module binds the concrete `PrismaUserRepository` at runtime. `UpdateLocationService` additionally receives the `GEOCODING_SERVICE` `ClientProxy` to call `api-location` for reverse geocoding.

---

## Inter-Service Communication

`api-user` acts as a consumer of `api-location` for the reverse geocoding step inside `UpdateLocationService`:

```
Gateway ──TCP──▶ api-user (update_location)
                    │
                    └──TCP──▶ api-location (reverse_geocode)
                                    │
                              NominatimGeocodingService
                              (external HTTP → openstreetmap.org)
```

If `api-location` is unavailable, `UpdateLocationService` gracefully degrades: the location is saved with `locationName: null` rather than failing the request.

---

## Common Commands

```bash
# Start individual services
npm run start:user          # TCP on port 3001
npm run start:location      # TCP on port 3002
npm run start:gateway       # HTTP on port 3000

# Build
npm run build:user
npm run build:location
npm run build:gateway

# Start PostgreSQL
docker compose up -d
```

---

## Environment Variables

| Variable | Default | Used By |
|----------|---------|---------|
| `PORT` | `3000` | api-gateway |
| `USER_SERVICE_HOST` | `localhost` | api-gateway |
| `USER_SERVICE_PORT` | `3001` | api-gateway, api-user |
| `LOCATION_SERVICE_HOST` | `localhost` | api-user (for GEOCODING_SERVICE client) |
| `LOCATION_SERVICE_PORT` | `3002` | api-user (for GEOCODING_SERVICE client), api-location |
| `DATABASE_URL` | — | @app/database (all services) |

---

## Benefits

- **Independent deployment** — Each service can be built, tested, and deployed separately
- **Testability** — Mock repository contracts to unit test use cases without a database
- **Flexibility** — Swap Prisma for another ORM by only changing the Infrastructure layer
- **Maintainability** — Business rules are isolated within each service's domain layer
- **Scalability** — Scale individual services based on load; add new microservices following the same pattern
- **Fault isolation** — A failure in the location service doesn't take down user operations
