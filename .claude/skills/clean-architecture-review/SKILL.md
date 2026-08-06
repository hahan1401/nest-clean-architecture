---
name: clean-architecture-review
description: Review changes in this NestJS monorepo against its clean-architecture, error-handling, logging, and type-safety conventions before committing. Use when the user asks to review a diff/PR, check conventions, or right after implementing a feature in an api-* service. Complements /code-review (which hunts for bugs) — this enforces project rules.
---

# Clean-architecture convention review

Run through this checklist against the changed files. Report violations with `file:line` and a
fix. The authoritative narrative is `ARCHITECTURE.md`; this is the enforceable checklist.

## Dependency rule (`Presentation → Application → Domain ← Infrastructure`)
- [ ] `domain/` and `application/` import **no** `@nestjs/common` exceptions and **no** transport
      packages (`@nestjs/microservices`, `@nestjs/platform-*`, `@golevelup/*`). Domain interfaces
      carry no decorators.
- [ ] Business failures are signalled by throwing `DomainError` subclasses from `@app/common`
      (`NotFoundError`, `ConflictError`, `ValidationError`, `UnauthorizedError`, `ForbiddenError`,
      `DependencyError`) — never `HttpException` / `RpcException` in domain or application code.
- [ ] Infrastructure adapters wrap third-party/SDK/HTTP failures in `DependencyError` so callers
      stay transport-agnostic.
- [ ] Ports/abstractions are bound to implementations in the feature module via
      `{ provide: SomePort, useClass: SomeImpl }`; application code depends on the abstraction.

## Boundary & error handling
- [ ] `application`/`domain` contain no `try/catch` whose only purpose is to remap an error — let
      it bubble to the global filter. Catch only to add context or a real fallback.
- [ ] Presentation (`@MessagePattern` controllers, gateway HTTP controllers) contain no
      error-translation code — `AllExceptionsRpcFilter` (services) and `AllExceptionsHttpFilter`
      (gateway) do that, registered via `APP_FILTER` in each `app.module.ts`.
- [ ] Controllers map domain entities to the response DTOs from `@app/common`.

## Logging (pino only)
- [ ] No use of the NestJS built-in `Logger` anywhere (including bootstrap). Classes inject
      `PinoLogger` and call `setContext(...)`.
- [ ] Log calls use pino's structured signature `logger.info(mergingObject, message)` /
      `logger.error({ err }, message)` — not string concatenation.
- [ ] `app.module.ts` registers `LoggerModule.forRoot({ pinoHttp: createPinoHttpConfig('API-<NAME>') })`
      and `LoggingInterceptor` via `APP_INTERCEPTOR`.
- [ ] `main.ts` uses `bufferLogs: true` + `app.useLogger(app.get(Logger))` + `app.flushLogs()`.

## Correlation
- [ ] Object-shaped payloads sent from the gateway forward `requestId` from `CorrelatedRequest`.
- [ ] Filters/interceptor read `requestId` from typed `getData<{ requestId?: string }>()` — not `any`.

## Type-safety (eslint runs `recommendedTypeChecked` — no `any` leaks)
- [ ] `catch` clauses are annotated `(e: unknown)` (the tsconfig does not enable
      `useUnknownInCatchVariables`, so bare `catch (e)` is `any`).
- [ ] `ConfigService.get/getOrThrow` calls pass the `<T>` generic.
- [ ] `ClientProxy.send<T>()` and `switchToRpc().getData<T>()` pass result generics.
- [ ] JSON boundaries (RMQ deserializers, raw query rows) are typed, not left `any`.

## Bootstrap & lint hygiene
- [ ] `main.ts` ends with `void bootstrap();` (no floating promise).
- [ ] No unused imports; no `async` on functions without `await`.

## Shared constants
- [ ] New service tokens live in `libs/common/src/constants/services.ts`; message patterns in
      `constants/message-patterns.ts`; queue/exchange names in `constants/queues.ts`. All are
      re-exported by `libs/common/src/index.ts`.

## Final gate
Run and require all clean:
```bash
npx tsc --noEmit && npx eslint "apps/**/*.ts" "libs/**/*.ts" && npx jest
```
