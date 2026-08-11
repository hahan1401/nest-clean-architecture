-- An hour between one guest and the next.
--
-- The house has stopped selling fixed check-in and check-out hours: a guest
-- arrives and leaves when they choose. The only thing left between two stays is
-- the time it takes to turn the room over, and that is now a real invariant
-- rather than a habit. Check out at 15:00 and the room is bookable from 16:00.
--
-- Before this, `bookings_room_no_overlap` compared the stays as given, so
-- 15:00 -> 15:00 was a legal handover and the site could sell a room that
-- nobody had cleaned.

-- ---------------------------------------------------------------------------
-- 1. The occupancy window, as a function the index can trust.
-- ---------------------------------------------------------------------------
--
-- IMMUTABLE is load-bearing and it is not a lie, but it is only true for an
-- hour-sized interval. `timestamptz + interval` is merely STABLE in general
-- because day and month components depend on the session time zone across a DST
-- boundary; hours, minutes and seconds are added as a fixed number of seconds
-- and cannot depend on anything. Widening this to `interval '1 day'` would make
-- the marking false and the index wrong - change the number of hours, never the
-- unit.
CREATE OR REPLACE FUNCTION room_stay_occupancy(check_in timestamptz, check_out timestamptz)
  RETURNS tstzrange
  LANGUAGE sql
  IMMUTABLE
  PARALLEL SAFE
AS $$
  SELECT tstzrange(check_in, check_out + interval '1 hour', '[)')
$$;

COMMENT ON FUNCTION room_stay_occupancy(timestamptz, timestamptz) IS
  'What a stay takes out of a room: the guest''s range plus the turnover hour. Kept in step with TURNOVER_MS in apps/api-booking/src/domain/models/date-range.ts.';

-- ---------------------------------------------------------------------------
-- 2. Refuse to apply against data the new rule would already forbid.
-- ---------------------------------------------------------------------------
--
-- ADD CONSTRAINT would fail here anyway, with a message naming neither booking.
-- Two stays already sold an hour apart is an operational problem - somebody has
-- to move a guest - so the migration says exactly which ones rather than
-- guessing on their behalf. Nothing here edits a booking.
DO $$
DECLARE
  clash record;
BEGIN
  SELECT a."reference" AS earlier_ref, a."check_out" AS earlier_out,
         b."reference" AS later_ref,  b."check_in"  AS later_in,
         a."room_id"   AS room_id
    INTO clash
    FROM "bookings" a
    JOIN "bookings" b
      ON b."room_id" = a."room_id"
     AND b."id" <> a."id"
     AND a."check_out" <= b."check_in"
     AND room_stay_occupancy(a."check_in", a."check_out")
      && room_stay_occupancy(b."check_in", b."check_out")
   WHERE a."room_id" IS NOT NULL
     AND a."status" IN ('PENDING', 'CONFIRMED', 'COMPLETED')
     AND b."status" IN ('PENDING', 'CONFIRMED', 'COMPLETED')
   LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION
      'Turnover hour: on room %, booking % leaves at % and booking % arrives at % - less than an hour apart. Move one of them, then re-run this migration.',
      clash.room_id, clash.earlier_ref, clash.earlier_out, clash.later_ref, clash.later_in;
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- 3. THE invariant, restated over occupancy windows.
-- ---------------------------------------------------------------------------
--
-- Still '[)', so two stays exactly an hour apart do not collide and anything
-- closer does. The status predicate is unchanged and must stay identical to
-- SLOT_HOLDING_STATUSES in the application - if the two drift, availability and
-- the database start disagreeing and bookings fail with a 409 the UI said was
-- impossible.
ALTER TABLE "bookings" DROP CONSTRAINT IF EXISTS "bookings_room_no_overlap";

ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_room_no_overlap"
  EXCLUDE USING gist (
    "room_id" WITH =,
    room_stay_occupancy("check_in", "check_out") WITH &&
  )
  WHERE (
    "room_id" IS NOT NULL
    AND "status" IN ('PENDING'::"booking_status",
                     'CONFIRMED'::"booking_status",
                     'COMPLETED'::"booking_status")
  );
