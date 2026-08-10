-- Correction to 20260810170000: that migration wrote the house's 13:00 / 11:00
-- as UTC, but the house is on the ridge above Da Lat, which is UTC+7 all year
-- (Vietnam has no daylight saving). A stay stored as 13:00Z reads as 20:00 to
-- everyone standing in it.
--
-- Shift the stored instants back onto the house clock: 13:00 local is 06:00Z,
-- 11:00 local is 04:00Z. Applied to every room booking, including terminal ones,
-- so history stays consistent with the rule the application now applies.
ALTER TABLE "bookings" DROP CONSTRAINT IF EXISTS "bookings_room_no_overlap";

UPDATE "bookings"
SET "check_in"  = "check_in"  - interval '7 hours',
    "check_out" = "check_out" - interval '7 hours'
WHERE "room_id" IS NOT NULL
  AND "check_in" IS NOT NULL
  AND "check_out" IS NOT NULL;

-- Unchanged in shape; every stay moved by the same offset, so no pair that was
-- disjoint can have become overlapping.
ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_room_no_overlap"
  EXCLUDE USING gist (
    "room_id" WITH =,
    tsrange("check_in", "check_out", '[)') WITH &&
  )
  WHERE (
    "room_id" IS NOT NULL
    AND "status" IN ('PENDING'::"booking_status",
                     'CONFIRMED'::"booking_status",
                     'COMPLETED'::"booking_status")
  );
