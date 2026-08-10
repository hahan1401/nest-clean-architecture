import { BookingStatus } from '@app/database';

/**
 * The statuses that hold a slot. This list must stay identical to the WHERE
 * predicate of the bookings_room_no_overlap exclusion constraint - if the two
 * ever drift, availability queries and the database invariant start disagreeing
 * and bookings fail with a 409 that the UI said was impossible.
 */
export const SLOT_HOLDING_STATUSES = [
  BookingStatus.PENDING,
  BookingStatus.CONFIRMED,
  BookingStatus.COMPLETED,
] as const;

/** Statuses a booking can still be moved out of. */
export const ACTIVE_STATUSES = [BookingStatus.PENDING, BookingStatus.CONFIRMED] as const;
