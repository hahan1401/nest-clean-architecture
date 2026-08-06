---
name: new-microservice
description: Scaffold a new NestJS microservice app (apps/api-<name>) in this monorepo with the full clean-architecture skeleton, TCP bootstrap, pino logging, global filters, nest-cli.json registration, @app/common tokens/patterns, package.json scripts, and gateway wiring. Use when the user asks to add/create a new service, module app, or api-* microservice.
---

# Add a new microservice (`api-<name>`)

Every service in this repo is a standalone NestJS app under `apps/` that follows the
same 4 layers: `presentation → application → domain ← infrastructure`. Copy the
conventions from an existing service (`apps/api-location` is the smallest reference;
`apps/api-user` is the fullest). RabbitMQ-based services differ in bootstrap — see
`apps/api-email` / `apps/api-notification` for that variant.

## Checklist

1. **Pick identifiers**: app dir `api-<name>`, token `<NAME>_SERVICE`, pattern group
   `<NAME>_PATTERNS`, pino label `API-<NAME>`, a free port, env `<NAME>_SERVICE_PORT`.

2. **Create the directory tree** under `apps/api-<name>/src/`:
   ```
   domain/{usecases,ports,repositories}
   application/usecases
   infrastructure/{services,repositories}
   presentation/{controllers,modules}
   main.ts
   app.module.ts
   ```

3. **`apps/api-<name>/tsconfig.app.json`** — copy verbatim from another app, only change `outDir`:
   ```json
   {
     "extends": "../../tsconfig.json",
     "compilerOptions": { "declaration": false, "outDir": "../../dist/apps/api-<name>" },
     "include": ["src/**/*"],
     "exclude": ["node_modules", "dist", "test", "**/*spec.ts"]
   }
   ```

4. **`src/main.ts`** — TCP microservice bootstrap. Copy `apps/api-location/src/main.ts`
   and change the port env var + the "running on port" message. Keep every idiom:
   `config({ path: resolve(process.cwd(), '.env.local'), override: true })`,
   `createMicroservice<MicroserviceOptions>` with `Transport.TCP`, host `'0.0.0.0'`,
   `bufferLogs: true`, `app.useLogger(app.get(Logger))`, `app.flushLogs()`,
   `ValidationPipe({ whitelist: true, transform: true })`, and end with `void bootstrap();`
   (never a bare `bootstrap();` — it trips `no-floating-promises`).

5. **`src/app.module.ts`** — copy `apps/api-user/src/app.module.ts`:
   - `ConfigModule.forRoot({ isGlobal: true, envFilePath: [join(process.cwd(),'.env.local'), join(process.cwd(),'apps/api-<name>/.env.local')] })`
   - `LoggerModule.forRoot({ pinoHttp: createPinoHttpConfig('API-<NAME>') })`
   - import the feature module
   - providers: `{ provide: APP_FILTER, useClass: AllExceptionsRpcFilter }` and
     `{ provide: APP_INTERCEPTOR, useClass: LoggingInterceptor }` (both from `@app/common`).
   - add `DatabaseModule` (from `@app/database`) to imports only if the service touches Postgres.

6. **Feature module** `src/presentation/modules/<name>.module.ts` — declares the controller
   and providers. Bind ports to implementations with `{ provide: SomePort, useClass: SomeImpl }`
   (see `apps/api-user/.../user.module.ts`). If it calls another service over TCP, register a
   `ClientsModule.registerAsync([...])` with a `useFactory` reading `configService.getOrThrow<string>('HOST_NAME')`
   and `getOrThrow<number>('<DEP>_SERVICE_PORT')` — always pass the `<T>` generic to `getOrThrow`.

7. **Register the app in `nest-cli.json`** under `projects` (copy an existing block, swap the name).

8. **Add tokens & patterns in `@app/common`**:
   - `libs/common/src/constants/services.ts`: `export const <NAME>_SERVICE = '<NAME>_SERVICE';`
   - `libs/common/src/constants/message-patterns.ts`: `export const <NAME>_PATTERNS = { ... } as const;`
   These files are re-exported by `libs/common/src/index.ts` already.

9. **Add scripts to `package.json`**: `"<name>:dev": "nest start api-<name> --watch"` and
   `"build:<name>": "nest build api-<name>"`.

10. **Wire the gateway** (only if the service is reachable over HTTP):
    - In `apps/api-gateway/src/app.module.ts` add a `ClientsModule.register([{ name: <NAME>_SERVICE, transport: Transport.TCP, options: { host: process.env.<NAME>_SERVICE_HOST || 'localhost', port: parseInt(process.env.<NAME>_SERVICE_PORT || '<port>') } }])`.
    - Add `apps/api-gateway/src/controllers/<name>.controller.ts` proxying via `@Inject(<NAME>_SERVICE) ClientProxy` and `lastValueFrom(client.send(PATTERN, payload))`; forward `req.requestId` (from `CorrelatedRequest`) on object payloads. Register it in the gateway module `controllers`.

11. **Env**: add `<NAME>_SERVICE_PORT` (and `<NAME>_SERVICE_HOST` if the gateway needs it) to
    `.env.example`; create `apps/api-<name>/.env.local` if the service needs its own secrets.

12. **Document** in `ARCHITECTURE.md` — the services table (port/transport/role) and the env-var table.

13. **Verify**: `npm run build:<name>` && `npx tsc --noEmit` && `npx eslint "apps/api-<name>/**/*.ts"` &&
    `npx jest`. All must be clean.

## Guardrails
- Domain and application layers must not import `@nestjs/common` exceptions or any transport
  package — throw `DomainError` subclasses from `@app/common` instead.
- Presentation contains no error-handling; the global filters translate errors at the boundary.
- See the `clean-architecture-review` skill for the full convention checklist.
