-- Booking domain (apps/api-booking).
--
-- Contains hand-written SQL that Prisma's differ cannot see:
--   * CREATE EXTENSION btree_gist
--   * the EXCLUDE constraint "bookings_room_no_overlap" - the room
--     double-booking invariant. Its GiST index shows up in pg_index, so
--     `prisma migrate dev` WILL generate a DROP for it in every subsequent
--     migration. Delete that line by hand, same as the ivfflat index in
--     20260727103000 and the uuid defaults in 20260728073907.
--   * the CHECK constraints below (Prisma does not model CHECK).
--
-- NOTE: prisma migrate generated three extra statements here that were removed
-- by hand - a DROP of document_chunks_embedding_ivfflat_idx and DROP DEFAULT on
-- the documents / document_chunks id columns. Both exist only in hand-written
-- migrations, so Prisma's diff cannot see them and tries to revert them on
-- every subsequent migration.
--
-- Deliberately NOT added: gen_random_uuid() defaults on the seven new tables.
-- They are written through the Prisma model API, which generates UUIDs
-- client-side, and each default would add another DROP DEFAULT to strip from
-- every future migration.

-- CreateExtension
-- btree_gist supplies the GiST opclass for the TEXT room_id column, which the
-- exclusion constraint at the bottom of this file needs alongside the built-in
-- daterange opclass.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- CreateEnum
CREATE TYPE "booking_status" AS ENUM ('PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "bookable_type" AS ENUM ('ROOM', 'TOUR');

-- CreateEnum
CREATE TYPE "departure_status" AS ENUM ('OPEN', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "price_source" AS ENUM ('BASE', 'RULE', 'DEPARTURE_OVERRIDE');

-- CreateTable
CREATE TABLE "rooms" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "max_guests" INTEGER NOT NULL,
    "base_price" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tours" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "duration_days" INTEGER NOT NULL,
    "base_price_per_person" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tour_departures" (
    "id" TEXT NOT NULL,
    "tour_id" TEXT NOT NULL,
    "departure_date" DATE NOT NULL,
    "capacity" INTEGER NOT NULL,
    "booked_seats" INTEGER NOT NULL DEFAULT 0,
    "price_override" INTEGER,
    "status" "departure_status" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tour_departures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_rules" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "room_id" TEXT,
    "tour_id" TEXT,
    "start_date" DATE,
    "end_date" DATE,
    "days_of_week" INTEGER[],
    "amount" INTEGER NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "price_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "cancellation_token" TEXT NOT NULL,
    "type" "bookable_type" NOT NULL,
    "status" "booking_status" NOT NULL DEFAULT 'PENDING',
    "room_id" TEXT,
    "check_in" DATE,
    "check_out" DATE,
    "tour_departure_id" TEXT,
    "seats" INTEGER,
    "guests" INTEGER NOT NULL,
    "customer_name" TEXT NOT NULL,
    "customer_email" TEXT NOT NULL,
    "customer_phone" TEXT NOT NULL,
    "total_amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "notes" TEXT,
    "hold_expires_at" TIMESTAMP(3),
    "confirmed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_lines" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "line_date" DATE NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_amount" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "price_source" "price_source" NOT NULL,
    "price_rule_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rooms_code_key" ON "rooms"("code");

-- CreateIndex
CREATE INDEX "rooms_is_active_max_guests_idx" ON "rooms"("is_active", "max_guests");

-- CreateIndex
CREATE UNIQUE INDEX "tours_slug_key" ON "tours"("slug");

-- CreateIndex
CREATE INDEX "tours_is_active_idx" ON "tours"("is_active");

-- CreateIndex
CREATE INDEX "tour_departures_status_departure_date_idx" ON "tour_departures"("status", "departure_date");

-- CreateIndex
CREATE UNIQUE INDEX "tour_departures_tour_id_departure_date_key" ON "tour_departures"("tour_id", "departure_date");

-- CreateIndex
CREATE INDEX "price_rules_room_id_is_active_start_date_end_date_idx" ON "price_rules"("room_id", "is_active", "start_date", "end_date");

-- CreateIndex
CREATE INDEX "price_rules_tour_id_is_active_start_date_end_date_idx" ON "price_rules"("tour_id", "is_active", "start_date", "end_date");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_reference_key" ON "bookings"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_cancellation_token_key" ON "bookings"("cancellation_token");

-- CreateIndex
CREATE INDEX "bookings_room_id_status_check_in_check_out_idx" ON "bookings"("room_id", "status", "check_in", "check_out");

-- CreateIndex
CREATE INDEX "bookings_tour_departure_id_status_idx" ON "bookings"("tour_departure_id", "status");

-- CreateIndex
CREATE INDEX "bookings_status_hold_expires_at_idx" ON "bookings"("status", "hold_expires_at");

-- CreateIndex
CREATE INDEX "bookings_customer_email_created_at_idx" ON "bookings"("customer_email", "created_at");

-- CreateIndex
CREATE INDEX "booking_lines_price_rule_id_idx" ON "booking_lines"("price_rule_id");

-- CreateIndex
CREATE INDEX "booking_lines_line_date_idx" ON "booking_lines"("line_date");

-- CreateIndex
CREATE UNIQUE INDEX "booking_lines_booking_id_line_date_key" ON "booking_lines"("booking_id", "line_date");

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
-- Hand-written invariants below this line. See the header.
-- ---------------------------------------------------------------------------

-- A row is either a well-formed ROOM booking or a well-formed TOUR booking,
-- never a hybrid. This is what lets every availability query assume the room
-- columns are non-null whenever room_id is non-null.
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
-- '[)' is half-open, so a checkout on the 14th and a check-in on the 14th are
-- NOT a conflict (same-day turnover is legal).
--
-- The WHERE predicate keeps CANCELLED/EXPIRED rows out of the index entirely,
-- so cancelling a booking frees the dates atomically with the status change and
-- needs no compensating write.
--
-- COMPLETED stays INSIDE the predicate on purpose: dropping it out would let the
-- daily maintenance job silently re-open historical dates, so a mistyped
-- backdated booking could overlap a stay that actually happened.
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

-- Seat counter guard. The conditional UPDATE in the repository is the primary
-- mechanism; this CHECK is the second wall for anyone writing the counter
-- without it.
ALTER TABLE "tour_departures" ADD CONSTRAINT "tour_departures_capacity_check"
  CHECK ("capacity" > 0);
ALTER TABLE "tour_departures" ADD CONSTRAINT "tour_departures_seats_check"
  CHECK ("booked_seats" >= 0 AND "booked_seats" <= "capacity");

-- A price rule targets exactly one product, over a coherent window.
ALTER TABLE "price_rules" ADD CONSTRAINT "price_rules_target_check"
  CHECK (num_nonnulls("room_id", "tour_id") = 1);
ALTER TABLE "price_rules" ADD CONSTRAINT "price_rules_window_check"
  CHECK ("start_date" IS NULL OR "end_date" IS NULL OR "end_date" >= "start_date");
ALTER TABLE "price_rules" ADD CONSTRAINT "price_rules_dow_check"
  CHECK ("days_of_week" <@ ARRAY[0, 1, 2, 3, 4, 5, 6]);

-- Money is whole VND and never negative.
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_base_price_check"
  CHECK ("base_price" >= 0 AND "max_guests" > 0);
ALTER TABLE "tours" ADD CONSTRAINT "tours_base_price_check"
  CHECK ("base_price_per_person" >= 0 AND "duration_days" > 0);
ALTER TABLE "tour_departures" ADD CONSTRAINT "tour_departures_price_check"
  CHECK ("price_override" IS NULL OR "price_override" >= 0);
ALTER TABLE "price_rules" ADD CONSTRAINT "price_rules_amount_check"
  CHECK ("amount" >= 0);
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_total_check"
  CHECK ("total_amount" >= 0 AND "guests" > 0);
ALTER TABLE "booking_lines" ADD CONSTRAINT "booking_lines_amount_check"
  CHECK ("quantity" > 0 AND "unit_amount" >= 0 AND "amount" = "quantity" * "unit_amount");
