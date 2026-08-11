-- One temporal shape for the whole database: every date and every timestamp
-- becomes `timestamptz`, an instant.
--
-- Why: the schema carried two shapes. `date` columns (departure_date,
-- start_date, end_date, line_date) held calendar days, `timestamp` columns held
-- instants with their zone left to convention, and the API converted between
-- them - which is what produced the checkIn/checkOut asymmetry, date-only going
-- in and an ISO instant coming back. A guest now picks the hour as well as the
-- day, so the day-only columns cannot hold what they are given.
--
-- After this migration there is exactly one rule: a temporal column is an
-- instant, the wire carries ISO 8601, and the house clock (Asia/Ho_Chi_Minh,
-- UTC+7 year round, no DST) is applied only when a human has to read a time.
--
-- Backfill: existing `timestamp` values are already UTC instants, so they are
-- reinterpreted with AT TIME ZONE 'UTC' and do not move. Existing `date` values
-- are midnight-anchored calendar days and are given the house time of day their
-- column means (below), so history reads the way it always did.
--
-- Consequence worth knowing: tour_departures' (tour_id, departure_date) unique
-- key now compares instants, so a tour may have a morning AND an afternoon
-- departure on one day. That is the point of a departure carrying a time, but it
-- does loosen the old "one departure per tour per day" invariant. Day-level
-- uniqueness, if it is ever wanted back, needs a functional unique index on
-- (tour_id, (departure_date AT TIME ZONE 'Asia/Ho_Chi_Minh')::date).

-- The constraint mentions both stay columns, so it has to go before the type
-- change and be rebuilt after. Postgres would otherwise refuse the ALTER.
ALTER TABLE "bookings" DROP CONSTRAINT IF EXISTS "bookings_room_no_overlap";

-- ---------------------------------------------------------------------------
-- 1. timestamp -> timestamptz. Same instants, now self-describing.
-- ---------------------------------------------------------------------------

ALTER TABLE "users"
  ALTER COLUMN "location_updated_at" TYPE timestamptz(3) USING "location_updated_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "created_at"          TYPE timestamptz(3) USING "created_at"          AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at"          TYPE timestamptz(3) USING "updated_at"          AT TIME ZONE 'UTC';

ALTER TABLE "documents"
  ALTER COLUMN "created_at" TYPE timestamptz(3) USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at" TYPE timestamptz(3) USING "updated_at" AT TIME ZONE 'UTC';

ALTER TABLE "document_chunks"
  ALTER COLUMN "created_at" TYPE timestamptz(3) USING "created_at" AT TIME ZONE 'UTC';

ALTER TABLE "rooms"
  ALTER COLUMN "created_at" TYPE timestamptz(3) USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at" TYPE timestamptz(3) USING "updated_at" AT TIME ZONE 'UTC';

ALTER TABLE "tours"
  ALTER COLUMN "created_at" TYPE timestamptz(3) USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at" TYPE timestamptz(3) USING "updated_at" AT TIME ZONE 'UTC';

ALTER TABLE "tour_departures"
  ALTER COLUMN "created_at" TYPE timestamptz(3) USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at" TYPE timestamptz(3) USING "updated_at" AT TIME ZONE 'UTC';

ALTER TABLE "price_rules"
  ALTER COLUMN "created_at" TYPE timestamptz(3) USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at" TYPE timestamptz(3) USING "updated_at" AT TIME ZONE 'UTC';

ALTER TABLE "bookings"
  ALTER COLUMN "check_in"        TYPE timestamptz(3) USING "check_in"        AT TIME ZONE 'UTC',
  ALTER COLUMN "check_out"       TYPE timestamptz(3) USING "check_out"       AT TIME ZONE 'UTC',
  ALTER COLUMN "hold_expires_at" TYPE timestamptz(3) USING "hold_expires_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "confirmed_at"    TYPE timestamptz(3) USING "confirmed_at"    AT TIME ZONE 'UTC',
  ALTER COLUMN "cancelled_at"    TYPE timestamptz(3) USING "cancelled_at"    AT TIME ZONE 'UTC',
  ALTER COLUMN "completed_at"    TYPE timestamptz(3) USING "completed_at"    AT TIME ZONE 'UTC',
  ALTER COLUMN "created_at"      TYPE timestamptz(3) USING "created_at"      AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at"      TYPE timestamptz(3) USING "updated_at"      AT TIME ZONE 'UTC';

ALTER TABLE "booking_lines"
  ALTER COLUMN "created_at" TYPE timestamptz(3) USING "created_at" AT TIME ZONE 'UTC';

-- ---------------------------------------------------------------------------
-- 2. date -> timestamptz. Each column gets the house time of day it means.
-- ---------------------------------------------------------------------------

-- A journey leaves at 07:10 on the ridge - the hour the site has always printed
-- next to a departure. It is the only value in this migration that is a choice
-- rather than a consequence; every existing departure inherits it.
ALTER TABLE "tour_departures"
  ALTER COLUMN "departure_date" TYPE timestamptz(3)
    USING ("departure_date"::timestamp + time '07:10') AT TIME ZONE 'Asia/Ho_Chi_Minh';

-- A price rule's window is INCLUSIVE of end_date, and the application matches a
-- night by the instant that night begins. Opening the window at 00:00 and
-- closing it at the last millisecond of the day preserves that exactly: every
-- night starting on end_date is still inside it.
ALTER TABLE "price_rules"
  ALTER COLUMN "start_date" TYPE timestamptz(3)
    USING ("start_date"::timestamp + time '00:00') AT TIME ZONE 'Asia/Ho_Chi_Minh',
  ALTER COLUMN "end_date" TYPE timestamptz(3)
    USING ("end_date"::timestamp + time '23:59:59.999') AT TIME ZONE 'Asia/Ho_Chi_Minh';

-- A line labels the night that STARTS on this day, so it anchors to the start of
-- the house day. (booking_id, line_date) therefore still means one row per night.
ALTER TABLE "booking_lines"
  ALTER COLUMN "line_date" TYPE timestamptz(3)
    USING ("line_date"::timestamp + time '00:00') AT TIME ZONE 'Asia/Ho_Chi_Minh';

-- ---------------------------------------------------------------------------
-- 3. THE invariant, restated over timezone-aware instants.
-- ---------------------------------------------------------------------------
--
-- tstzrange, not tsrange: the bounds carry their zone now. Still '[)', so a stay
-- ending at 11:00 and one starting at 13:00 the same day do not collide, and two
-- stays sharing any instant still do.
--
-- The predicate is unchanged and must stay identical to SLOT_HOLDING_STATUSES in
-- the application - if the two drift, availability and the database start
-- disagreeing and bookings fail with a 409 the UI said was impossible.
ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_room_no_overlap"
  EXCLUDE USING gist (
    "room_id" WITH =,
    tstzrange("check_in", "check_out", '[)') WITH &&
  )
  WHERE (
    "room_id" IS NOT NULL
    AND "status" IN ('PENDING'::"booking_status",
                     'CONFIRMED'::"booking_status",
                     'COMPLETED'::"booking_status")
  );
