---
name: typeorm-change
description: Change the Postgres data model in this repo with TypeORM — add/edit an ORM entity in libs/database, wire it into the connection, keep the domain model in sync, and handle pgvector (the vector type TypeORM can't model, created via raw SQL on boot and queried with DataSource.query). Use when the user asks to add/change a table, column, index, or embedding/vector storage.
---

# TypeORM schema & data-model workflow

Persistence lives in `libs/database` (`@app/database`). The single Postgres connection is
configured in `libs/database/src/database.module.ts` via `TypeOrmModule.forRootAsync` reading
`DATABASE_URL`. The dev DB is the `pgvector/pgvector:pg17` image in `docker-compose.yaml`.
`synchronize` is on outside production, so **entities are the source of truth** — there are no
migration files.

## Prerequisites
- `DATABASE_URL` set in `.env.local` (e.g. `postgresql://postgres@localhost:5432/nest_clean_architecture`).
- DB running: `docker compose up -d`.

## Two-model convention
Keep the ORM model separate from the domain model:
- **ORM entity** — decorated class under `libs/database/src/entities/*.orm-entity.ts`
  (e.g. `UserOrmEntity`, `@Entity('users')`). snake_case columns via `@Column({ name: '...' })`,
  `@PrimaryGeneratedColumn('uuid')`, `@CreateDateColumn`/`@UpdateDateColumn`, and
  `type: 'timestamptz'` / `'double precision'` where the Postgres type matters.
- **Domain model** — plain class under `libs/database/src/entities/*.entity.ts` (e.g. `User`,
  `UserWithDistance`) with a `constructor(partial)` + `Object.assign`. No decorators. Repositories
  map ORM → domain (`new User(ormRow)`).

## Adding / changing a table or column
1. Edit or add the `*.orm-entity.ts` class.
2. Register it in `DatabaseModule`'s `entities: [...]` array so `synchronize` manages it.
3. Update the matching domain model class and, if the shape crosses services, its consumers.
4. Export new classes from `libs/database/src/index.ts`.
5. Restart the DB-using app (`npm run user:dev` / `chatbot:dev`) — `synchronize` applies the change
   in dev. (For production, generate migrations with a TypeORM datasource instead of relying on
   `synchronize`.)

## Repositories
Bind the domain repository abstraction to a TypeORM implementation in the feature module
(`{ provide: UserRepository, useClass: UserTypeOrmRepository }`). The implementation injects the
TypeORM `DataSource` (globally available once `DatabaseModule` is imported) and uses
`dataSource.getRepository(XOrmEntity)` for typed CRUD, or `dataSource.query(sql, params)` /
`dataSource.transaction(async (manager) => manager.query(...))` for raw SQL. Positional params are
`$1, $2, …` with an args array — e.g. `dataSource.query('… WHERE id = $1', [id])`.

## pgvector (embeddings)
TypeORM cannot model the `vector` column type, so the `documents` / `document_chunks` tables are
**not** ORM entities. They are created idempotently on boot in
`apps/api-chatbot/.../gemini-ai.service.ts` (`onModuleInit`): `CREATE EXTENSION IF NOT EXISTS vector`,
`CREATE TABLE IF NOT EXISTS … "embedding" vector(1536) …`, plus indexes. All reads/writes go through
`DataSource.query` / `manager.query` with `$N::vector` casts and a `[${values.join(',')}]` literal.
If you add another vector-backed table, follow the same pattern: create it in that boot step and
access it via raw SQL, not an ORM entity.

## Verify
```bash
npx tsc --noEmit && npx eslint "apps/**/*.ts" "libs/**/*.ts" && npx jest
```
