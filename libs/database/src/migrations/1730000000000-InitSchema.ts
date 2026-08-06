import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Initial schema — faithfully reproduces the former Prisma migrations
 * (users, documents, document_chunks + pgvector). Every statement is guarded
 * with IF [NOT] EXISTS so it also applies cleanly to a database that Prisma
 * already partially created. Index/constraint names match Prisma's so they are
 * not duplicated on an existing database.
 */
export class InitSchema1730000000000 implements MigrationInterface {
  name = 'InitSchema1730000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS vector');

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
        "name" TEXT NOT NULL,
        "email" TEXT NOT NULL,
        "password" TEXT NOT NULL,
        "latitude" DOUBLE PRECISION,
        "longitude" DOUBLE PRECISION,
        "location_name" TEXT,
        "location_updated_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "users_pkey" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "users" ("email")',
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "documents" (
        "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
        "file_name" TEXT NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS "documents_file_name_key" ON "documents" ("file_name")',
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "document_chunks" (
        "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
        "document_id" TEXT NOT NULL,
        "chunk_index" INTEGER NOT NULL,
        "content" TEXT NOT NULL,
        "embedding" vector(1536) NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "document_chunks_pkey" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "document_chunks_document_id_idx" ON "document_chunks" ("document_id")',
    );
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "document_chunks_embedding_ivfflat_idx"
        ON "document_chunks"
        USING ivfflat ("embedding" vector_cosine_ops)
        WITH (lists = 100)
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'document_chunks_document_id_fkey'
        ) THEN
          ALTER TABLE "document_chunks"
            ADD CONSTRAINT "document_chunks_document_id_fkey"
            FOREIGN KEY ("document_id") REFERENCES "documents"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "document_chunks"');
    await queryRunner.query('DROP TABLE IF EXISTS "documents"');
    await queryRunner.query('DROP TABLE IF EXISTS "users"');
  }
}
