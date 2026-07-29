ALTER TABLE "documents"
ALTER COLUMN "id"
SET DEFAULT gen_random_uuid();

ALTER TABLE "document_chunks"
ALTER COLUMN "id"
SET DEFAULT gen_random_uuid();