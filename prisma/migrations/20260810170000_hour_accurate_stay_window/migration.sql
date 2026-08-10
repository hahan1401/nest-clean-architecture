-- Stays become hour-accurate: check_in / check_out move from `date` to
-- `timestamp`, holding the instants the room is occupied rather than the
-- calendar days it spans.
--
-- Why: under date-only storage a departure and an arrival on the same day
-- overlapped, because daterange('2027-02-16','2027-02-18','[)') and
-- daterange('2027-02-14','2027-02-16','[)') share no point but every stay
-- started at midnight, so a room could not be turned over on its checkout day
-- for a guest arriving that afternoon. With 13:00 arrival and 11:00 departure
-- the two ranges are genuinely disjoint.
--
-- The guest still picks calendar dates. The house times are applied in one
-- place in the application (domain/models/stay-window.ts); this migration
-- applies the same rule to rows already in the table.

-- The constraint mentions both columns, so it has to go before the type change
-- and be rebuilt after. Postgres would otherwise refuse the ALTER.
ALTER TABLE "bookings" DROP CONSTRAINT IF EXISTS "bookings_room_no_overlap";

ALTER TABLE "bookings"
  ALTER COLUMN "check_in"  TYPE timestamp(3) USING ("check_in"::timestamp  + time '13:00'),
  ALTER COLUMN "check_out" TYPE timestamp(3) USING ("check_out"::timestamp + time '11:00');

-- THE invariant, restated over instants. tsrange, not daterange: the bounds are
-- now timestamps. Still '[)', so a stay ending at 11:00 and one starting at
-- 13:00 the same day do not collide, and two stays sharing any instant still do.
--
-- The predicate is unchanged and must stay identical to SLOT_HOLDING_STATUSES
-- in the application - if the two drift, availability and the database start
-- disagreeing and bookings fail with a 409 the UI said was impossible.
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
