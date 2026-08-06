import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserOrmEntity } from './entities/user.orm-entity';
import { InitSchema1730000000000 } from './migrations/1730000000000-InitSchema';

/**
 * Shared database module. Establishes the single Postgres connection from
 * `DATABASE_URL` and registers the TypeORM entities.
 *
 * Schema is owned by migrations (not `synchronize`) so the full set of tables —
 * including the chatbot's pgvector `documents` / `document_chunks`, which
 * TypeORM cannot model as entities — is created in one place. `migrationsRun`
 * applies any pending migration when a DB-backed service boots; the same
 * migrations can be run explicitly with `npm run migration:run`.
 */
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: 'postgres',
        url: process.env.DATABASE_URL,
        entities: [UserOrmEntity],
        migrations: [InitSchema1730000000000],
        migrationsRun: true,
        synchronize: false,
      }),
    }),
  ],
})
export class DatabaseModule {}
