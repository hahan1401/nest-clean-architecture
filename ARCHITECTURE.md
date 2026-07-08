# Clean Architecture - NestJS + Prisma

```
┌──────────────────────────────────────────────────────────┐
│                    Presentation Layer                     │
│              (Controllers, Modules, Guards)               │
├──────────────────────────────────────────────────────────┤
│                    Application Layer                      │
│                (Use Cases, DTOs, Mappers)                 │
├──────────────────────────────────────────────────────────┤
│                      Domain Layer                         │
│          (Entities, Repository Contracts, Interfaces)     │
├──────────────────────────────────────────────────────────┤
│                   Infrastructure Layer                    │
│        (Database, External Services, Repositories)        │
└──────────────────────────────────────────────────────────┘
```

## Dependency Rule

Dependencies point **inward only**. Outer layers know about inner layers, but inner layers never reference outer layers.

```
Presentation → Application → Domain ← Infrastructure
```

---

## Layers

### 1. Domain Layer (`src/domain/`)

The **innermost layer** — contains the core business logic and has **zero external dependencies** (no NestJS, no Prisma, no libraries).

| Folder | Purpose |
|--------|---------|
| `entities/` | Core business objects that represent your domain concepts. They encapsulate the most critical business rules. |
| `repositories/` | Abstract contracts (abstract classes) that define what data operations exist — but not how they are implemented. |
| `usecases/` | Interfaces that describe application-level operations from a business perspective. |

**Rules:**
- No imports from any other layer
- No framework decorators
- Pure TypeScript classes and interfaces
- If this layer changes, the business itself has changed

---

### 2. Application Layer (`src/application/`)

Contains **application-specific business rules** — orchestrates the flow of data between the presentation and domain layers.

| Folder | Purpose |
|--------|---------|
| `usecases/` | Service classes that implement business workflows. Each service has a single responsibility (one public `execute` method). |
| `dtos/` | Data Transfer Objects that define and validate the shape of incoming data. Uses `class-validator` decorators for input validation. |

**Rules:**
- Depends only on the Domain layer
- Uses NestJS `@Injectable()` for dependency injection
- Receives abstract repository contracts via constructor injection
- Throws domain-relevant exceptions (`NotFoundException`, custom errors)
- Does NOT know about HTTP, databases, or external services

---

### 3. Infrastructure Layer (`src/infrastructure/`)

Contains **concrete implementations** of the abstractions defined in the domain layer. This is where frameworks and external tools live.

| Folder | Purpose |
|--------|---------|
| `database/` | Database connection management (`PrismaService`) and its NestJS module. |
| `repositories/` | Concrete repository implementations (e.g., `PrismaUserRepository`) that fulfill the abstract contracts from the domain layer. |

**Rules:**
- Implements interfaces/abstract classes defined in the Domain layer
- Contains all Prisma, database, and third-party service logic
- Can be swapped without affecting business logic (e.g., replace Prisma with TypeORM)
- Maps between database models and domain entities

---

### 4. Presentation Layer (`src/presentation/`)

The **outermost layer** — handles HTTP communication and wires everything together using NestJS modules.

| Folder | Purpose |
|--------|---------|
| `controllers/` | HTTP controllers that receive requests, delegate to use cases, and return responses. |
| `modules/` | NestJS feature modules that bind abstract contracts to concrete implementations via dependency injection. |

**Rules:**
- Translates HTTP requests into use case calls
- Handles HTTP-specific concerns (status codes, route params, request body)
- Binds abstractions to implementations in module `providers` array
- Does NOT contain business logic

---

## How Dependency Injection Connects the Layers

In `user.module.ts`:

```typescript
providers: [
  {
    provide: UserRepository,        // Abstract contract (Domain)
    useClass: PrismaUserRepository, // Concrete implementation (Infrastructure)
  },
  CreateUserService,                // Use case (Application)
]
```

The Application layer injects `UserRepository` (abstract) — it never knows about Prisma. The module binds the concrete `PrismaUserRepository` at runtime.

---

## Benefits

- **Testability** — Mock the repository contract to unit test use cases without a database
- **Flexibility** — Swap Prisma for another ORM by only changing the Infrastructure layer
- **Maintainability** — Business rules are isolated and clearly separated from framework code
- **Scalability** — New features follow the same pattern; the codebase stays consistent as it grows
