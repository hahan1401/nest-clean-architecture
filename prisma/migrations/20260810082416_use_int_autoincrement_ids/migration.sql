
/*
  Warnings:

  - The primary key for the `booking_lines` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `booking_lines` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `price_rule_id` column on the `booking_lines` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `bookings` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `bookings` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `room_id` column on the `bookings` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `tour_departure_id` column on the `bookings` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `document_chunks` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `document_chunks` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `documents` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `documents` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `price_rules` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `price_rules` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `room_id` column on the `price_rules` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `tour_id` column on the `price_rules` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `rooms` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `rooms` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `tour_departures` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `tour_departures` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `tours` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `tours` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `users` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `users` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Changed the type of `booking_id` on the `booking_lines` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `document_id` on the `document_chunks` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `tour_id` on the `tour_departures` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/

-- ---------------------------------------------------------------------------
-- Hand-edited: every id and foreign key moves from uuid to a SERIAL integer.
--
-- Postgres silently drops any CHECK/EXCLUDE constraint that mentions a column
-- being dropped, and Prisma models neither kind - so the three hand-written
-- invariants that reference "room_id" / "tour_id" / "tour_departure_id" would
-- vanish with the columns. They are dropped explicitly here and recreated
-- verbatim at the bottom of this file; the remaining CHECKs touch no retyped
-- column and survive untouched.
-- ---------------------------------------------------------------------------

-- DropConstraint (recreated at the bottom of this file)
ALTER TABLE "bookings" DROP CONSTRAINT IF EXISTS "bookings_shape_check";
ALTER TABLE "bookings" DROP CONSTRAINT IF EXISTS "bookings_room_no_overlap";
ALTER TABLE "price_rules" DROP CONSTRAINT IF EXISTS "price_rules_target_check";

-- DropForeignKey
ALTER TABLE "booking_lines" DROP CONSTRAINT "booking_lines_booking_id_fkey";

-- DropForeignKey
ALTER TABLE "booking_lines" DROP CONSTRAINT "booking_lines_price_rule_id_fkey";

-- DropForeignKey
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_room_id_fkey";

-- DropForeignKey
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_tour_departure_id_fkey";

-- DropForeignKey
ALTER TABLE "document_chunks" DROP CONSTRAINT "document_chunks_document_id_fkey";

-- DropForeignKey
ALTER TABLE "price_rules" DROP CONSTRAINT "price_rules_room_id_fkey";

-- DropForeignKey
ALTER TABLE "price_rules" DROP CONSTRAINT "price_rules_tour_id_fkey";

-- DropForeignKey
ALTER TABLE "tour_departures" DROP CONSTRAINT "tour_departures_tour_id_fkey";

-- AlterTable
ALTER TABLE "booking_lines" DROP CONSTRAINT "booking_lines_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
DROP COLUMN "booking_id",
ADD COLUMN     "booking_id" INTEGER NOT NULL,
DROP COLUMN "price_rule_id",
ADD COLUMN     "price_rule_id" INTEGER,
ADD CONSTRAINT "booking_lines_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
DROP COLUMN "room_id",
ADD COLUMN     "room_id" INTEGER,
DROP COLUMN "tour_departure_id",
ADD COLUMN     "tour_departure_id" INTEGER,
ADD CONSTRAINT "bookings_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "document_chunks" DROP CONSTRAINT "document_chunks_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
DROP COLUMN "document_id",
ADD COLUMN     "document_id" INTEGER NOT NULL,
ADD CONSTRAINT "document_chunks_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "documents" DROP CONSTRAINT "documents_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "documents_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "price_rules" DROP CONSTRAINT "price_rules_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
DROP COLUMN "room_id",
ADD COLUMN     "room_id" INTEGER,
DROP COLUMN "tour_id",
ADD COLUMN     "tour_id" INTEGER,
ADD CONSTRAINT "price_rules_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "rooms" DROP CONSTRAINT "rooms_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "rooms_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "tour_departures" DROP CONSTRAINT "tour_departures_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
DROP COLUMN "tour_id",
ADD COLUMN     "tour_id" INTEGER NOT NULL,
ADD CONSTRAINT "tour_departures_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "tours" DROP CONSTRAINT "tours_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "tours_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "users" DROP CONSTRAINT "users_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");

-- CreateIndex
CREATE INDEX "booking_lines_price_rule_id_idx" ON "booking_lines"("price_rule_id");

-- CreateIndex
CREATE UNIQUE INDEX "booking_lines_booking_id_line_date_key" ON "booking_lines"("booking_id", "line_date");

-- CreateIndex
CREATE INDEX "bookings_room_id_status_check_in_check_out_idx" ON "bookings"("room_id", "status", "check_in", "check_out");

-- CreateIndex
CREATE INDEX "bookings_tour_departure_id_status_idx" ON "bookings"("tour_departure_id", "status");

-- CreateIndex
CREATE INDEX "document_chunks_document_id_idx" ON "document_chunks"("document_id");

-- CreateIndex
CREATE INDEX "price_rules_room_id_is_active_start_date_end_date_idx" ON "price_rules"("room_id", "is_active", "start_date", "end_date");

-- CreateIndex
CREATE INDEX "price_rules_tour_id_is_active_start_date_end_date_idx" ON "price_rules"("tour_id", "is_active", "start_date", "end_date");

-- CreateIndex
CREATE UNIQUE INDEX "tour_departures_tour_id_departure_date_key" ON "tour_departures"("tour_id", "departure_date");

-- AddForeignKey
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tour_departures" ADD CONSTRAINT "tour_departures_tour_id_fkey" FOREIGN KEY ("tour_id") REFERENCES "tours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_rules" ADD CONSTRAINT "price_rules_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_rules" ADD CONSTRAINT "price_rules_tour_id_fkey" FOREIGN KEY ("tour_id") REFERENCES "tours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_tour_departure_id_fkey" FOREIGN KEY ("tour_departure_id") REFERENCES "tour_departures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_lines" ADD CONSTRAINT "booking_lines_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_lines" ADD CONSTRAINT "booking_lines_price_rule_id_fkey" FOREIGN KEY ("price_rule_id") REFERENCES "price_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Hand-written invariants restored, verbatim from 20260808150946_add_booking_domain.
-- See that migration for why each one exists.
-- ---------------------------------------------------------------------------

-- A row is either a well-formed ROOM booking or a well-formed TOUR booking,
-- never a hybrid.
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_shape_check" CHECK (
  (
    "type" = 'ROOM'
    AND "room_id" IS NOT NULL
    AND "check_in" IS NOT NULL
    AND "check_out" IS NOT NULL
    AND "check_out" > "check_in"
    AND "tour_departure_id" IS NULL
    AND "seats" IS NULL
  ) OR (
    "type" = 'TOUR'
    AND "tour_departure_id" IS NOT NULL
    AND "seats" IS NOT NULL
    AND "seats" > 0
    AND "room_id" IS NULL
    AND "check_in" IS NULL
    AND "check_out" IS NULL
  )
);

-- THE invariant: no two slot-holding bookings may overlap on the same room.
-- btree_gist (created by 20260808150946) covers integer equality just as it did
-- uuid equality, so the constraint carries over unchanged.
ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_room_no_overlap"
  EXCLUDE USING gist (
    "room_id" WITH =,
    daterange("check_in", "check_out", '[)') WITH &&
  )
  WHERE (
    "room_id" IS NOT NULL
    AND "status" IN ('PENDING'::"booking_status",
                     'CONFIRMED'::"booking_status",
                     'COMPLETED'::"booking_status")
  );

-- A price rule targets exactly one product.
ALTER TABLE "price_rules" ADD CONSTRAINT "price_rules_target_check"
  CHECK (num_nonnulls("room_id", "tour_id") = 1);
