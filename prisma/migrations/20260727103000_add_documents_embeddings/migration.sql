CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "documents_file_name_key" ON "documents"("file_name");

CREATE TABLE "document_chunks" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "chunk_index" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(768) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_chunks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "document_chunks_document_id_idx" ON "document_chunks"("document_id");

CREATE INDEX "document_chunks_embedding_ivfflat_idx"
    ON "document_chunks"
    USING ivfflat ("embedding" vector_cosine_ops)
    WITH (lists = 100);

ALTER TABLE "document_chunks"
    ADD CONSTRAINT "document_chunks_document_id_fkey"
    FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
