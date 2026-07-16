-- AlterTable
ALTER TABLE "users" ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "location_updated_at" TIMESTAMP(3),
ADD COLUMN     "longitude" DOUBLE PRECISION;
