---
name: new-usecase
description: Add a use case / feature to an existing microservice end-to-end following this repo's clean architecture — domain interface, application service + spec, module wiring, @app/common message pattern, @MessagePattern controller handler, and the optional api-gateway HTTP route. Use when the user asks to add an endpoint, message pattern, operation, or feature to an api-* service.
---

# Add a use case to an existing service

A single feature touches one file per layer plus the shared pattern constant. Follow the
order below. Reference slice: `create_user` across `apps/api-user`.

## Steps

1. **Message pattern** — add the key to the service's group in
   `libs/common/src/constants/message-patterns.ts`, e.g.:
   ```ts
   export const USER_PATTERNS = { /* ... */ ARCHIVE_USER: 'archive_user' } as const;
   ```

2. **Domain use-case interface** — `apps/api-<svc>/src/domain/usecases/<name>.usecase.ts`:
   ```ts
   export interface ArchiveUserUseCase {
     execute(id: string): Promise<User>;
   }
   ```
   No decorators, no framework imports. Reference entities from `@app/database`.

3. **New persistence?** If the use case needs a query that doesn't exist yet:
   - add the abstract method to the domain repository/port (e.g. `domain/repositories/user.repository.ts`),
   - implement it in the Prisma repo (`infrastructure/repositories/prisma-user.repository.ts`),
     wrapping rows in the entity class (`new User(row)`). For external calls (HTTP, SDKs),
     implement the port under `infrastructure/services/` and wrap third-party failures in
     `DependencyError`.

4. **Application service** — `apps/api-<svc>/src/application/usecases/<name>.service.ts`:
   ```ts
   @Injectable()
   export class ArchiveUserService implements ArchiveUserUseCase {
     constructor(private readonly userRepository: UserRepository) {}
     async execute(id: string): Promise<User> {
       const user = await this.userRepository.findById(id);
       if (!user) throw new NotFoundError('User not found');
       // ...business logic...
     }
   }
   ```
   Throw `DomainError` subclasses from `@app/common` (`NotFoundError`, `ConflictError`,
   `ValidationError`, `ForbiddenError`, `UnauthorizedError`, `DependencyError`). Do **not**
   `try/catch` just to remap an error — let it bubble to the global filter.

5. **Co-located spec** — `<name>.service.spec.ts`. Construct the service directly with mocked
   deps (no Nest TestingModule needed); cover the happy path and the failure path:
   ```ts
   let repo: jest.Mocked<UserRepository>;
   beforeEach(() => {
     repo = { findById: jest.fn(), /* ... */ } as unknown as jest.Mocked<UserRepository>;
     service = new ArchiveUserService(repo);
   });
   it('throws when missing', async () => {
     repo.findById.mockResolvedValue(null);
     await expect(service.execute('x')).rejects.toBeInstanceOf(NotFoundError);
   });
   ```

6. **Register the provider** — add the service class to the feature module's `providers`
   (`apps/api-<svc>/src/presentation/modules/<svc>.module.ts`).

7. **Controller handler** — in `apps/api-<svc>/src/presentation/controllers/<svc>.controller.ts`
   inject the service and add:
   ```ts
   @MessagePattern(USER_PATTERNS.ARCHIVE_USER)
   async archive(@Payload() id: string) {
     const user = await this.archiveUserService.execute(id);
     return new UserResponseDto(user);
   }
   ```
   Map domain entities to the response DTO from `@app/common`. No error handling here.

8. **Gateway route** (only for HTTP-exposed operations) — in
   `apps/api-gateway/src/controllers/<svc>.controller.ts` add the HTTP method and proxy:
   ```ts
   @Patch(':id/archive')
   archive(@Req() req: CorrelatedRequest, @Param('id') id: string) {
     return lastValueFrom(this.userClient.send(USER_PATTERNS.ARCHIVE_USER, id));
   }
   ```
   When the payload is an object, forward the correlation id: `{ ...dto, requestId: req.requestId }`.
   For streaming responses use `@Sse(...)` + `.pipe(map(...), catchError(err => throwError(() => new HttpException(...normalizeError(err)))))` (see the chatbot controller).
   Give `client.send<T>()` an explicit result generic so the return isn't `any`.
   Document the new route in `ARCHITECTURE.md`.

9. **Verify**: `npx tsc --noEmit` && `npx eslint "apps/**/*.ts" "libs/**/*.ts"` && `npx jest`.
