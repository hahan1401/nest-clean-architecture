import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserOrmEntity } from './entities/user.orm-entity';

/**
 * Shared database module. Establishes the single Postgres connection from
 * `DATABASE_URL` and registers the TypeORM entities. The connection is loaded
 * by main.ts via dotenv before Nest bootstraps, so `process.env.DATABASE_URL`
 * is populated here.
 *
 * `synchronize` keeps the ORM-managed tables (`users`) in step with the
 * entities outside production. The chatbot's `documents` / `document_chunks`
 * tables use the pgvector `vector` type, which TypeORM cannot model, so they
 * are created idempotently on boot in GeminiAIService instead.
 */
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: 'postgres',
        url: process.env.DATABASE_URL,
        entities: [UserOrmEntity],
        synchronize: process.env.NODE_ENV !== 'production',
      }),
    }),
  ],
})
export class DatabaseModule {}
