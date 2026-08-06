---
mode: 'agent'
description: 'Change the Postgres data model in this repo — edit prisma/schema.prisma, create/apply a migration, regenerate the client, update @app/database entities, and handle pgvector (Unsupported vector columns queried via raw SQL). Use when the user asks to add/change a table, column, index, migration, seed, or embedding/vector storage.'
---

# Prisma schema & migration workflow

The database is Postgres via the **pg driver adapter** (`@prisma/adapter-pg`, preview feature
`driverAdapters`) — see `libs/database/src/prisma.service.ts`. Prisma CLI config lives in
`prisma.config.ts`, which loads `DATABASE_URL` from `.env.local` / `.env`. The dev DB is the
`pgvector/pgvector:pg17` image from `docker-compose.yaml`.

## Prerequisites
- `DATABASE_URL` set in `.env.local` (e.g. `postgresql://postgres@localhost:5432/nest_clean_architecture`).
- DB running: `docker compose up -d`.

## Editing `prisma/schema.prisma`
Follow the existing conventions:
- `String @id @default(uuid())` for primary keys.
- snake_case DB columns via `@map("...")`, snake_case tables via `@@map("...")`.
- `createdAt DateTime @default(now()) @map("created_at")`, `updatedAt DateTime @updatedAt @map("updated_at")`.
- Relations use explicit `@relation(fields, references, onDelete)`; add `@@index([...])` for FKs.

### pgvector columns
Embedding columns are declared `embedding Unsupported("vector(1536)")` — Prisma cannot read/write
them through the typed client. Persist and query them with **raw SQL** using the
`PrismaService.$executeRawUnsafe` / `$queryRawUnsafe` methods and cast literals with `::vector`
(pattern already used in `apps/api-chatbot/.../gemini-ai.service.ts`):
```ts
await tx.$executeRawUnsafe(
  `INSERT INTO "document_chunks" (..., "embedding") VALUES (..., $4::vector)`,
  ..., `[${values.join(',')}]`,
);
```
The `vector` extension and any ivfflat/hnsw index must be created in migration SQL (see below);
they are not expressible in the Prisma schema.

## Creating & applying a migration
```bash
npx prisma migrate dev --name <short_snake_case_description>
```
This picks up `prisma.config.ts`, writes `prisma/migrations/<timestamp>_<name>/migration.sql`,
applies it, and regenerates the client. For pgvector/extensions or a custom index, **hand-edit
the generated `migration.sql`** (e.g. add `CREATE EXTENSION IF NOT EXISTS vector;` or a
`CREATE INDEX ... USING hnsw (...)`), then re-run `migrate dev` (or `migrate reset` in dev to
replay cleanly).

## After a schema change
- Regenerate the client if not already done: `npx prisma generate`.
- **Update `libs/database` entities** if the shape is consumed across services: entity classes
  live in `libs/database/src/entities/*.entity.ts` (plain classes with a `constructor(partial)` +
  `Object.assign`) and are exported from `libs/database/src/index.ts`. Repositories wrap Prisma
  rows in these entities (`new User(row)`). Keep the entity fields in sync with the model.
- Validate: `npx prisma validate`, then `npx tsc --noEmit`.

## Seeding
Seed logic is `prisma/seed.ts` (configured in both `prisma.config.ts` and `package.json#prisma.seed`).
Run: `npx prisma db seed`.

## Production / CI
Never run `migrate dev` there — use `npx prisma migrate deploy` to apply committed migrations.

## Commit
Always commit the generated `prisma/migrations/**` folder alongside the `schema.prisma` change.
