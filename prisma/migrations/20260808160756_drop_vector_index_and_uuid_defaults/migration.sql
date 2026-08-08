-- DropIndex
DROP INDEX "document_chunks_embedding_ivfflat_idx";

-- AlterTable
ALTER TABLE "document_chunks" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "documents" ALTER COLUMN "id" DROP DEFAULT;
