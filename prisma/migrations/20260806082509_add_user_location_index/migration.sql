-- Supports the bounding-box prefilter in findNearby: the planner range-scans the
-- latitude band and filters longitude inside it, instead of scanning every row and
-- running acos() on each one.
--
-- NOTE: prisma migrate generated two extra statements here that were removed by hand —
-- a DROP of "document_chunks_embedding_ivfflat_idx" and DROP DEFAULT on the documents /
-- document_chunks id columns. Both exist only in hand-written migrations (the vector
-- index sits on an Unsupported column, the defaults come from add_db_uuid_default), so
-- Prisma's diff cannot see them and tries to revert them on every subsequent migration.

-- CreateIndex
CREATE INDEX "users_latitude_longitude_idx" ON "users"("latitude", "longitude");
