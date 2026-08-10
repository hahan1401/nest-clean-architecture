/**
 * Outbound port: arranges for a PENDING booking's hold to be released at exactly
 * the moment it lapses, instead of whenever a poll next happens to run.
 *
 * Contract - read before implementing:
 *  - Scheduling is BEST EFFORT. Implementations MUST resolve even when the
 *    transport is unreachable, and MUST NOT throw. The booking is already
 *    committed; failing the create because a reminder could not be queued would
 *    lose a sale over a broker hiccup.
 *  - A missed schedule is a delay, not a leak: the reconciliation sweep still
 *    catches anything that never got a message.
 *  - Implementations must be bounded in time; the caller is a synchronous RPC
 *    handler.
 */
export abstract class BookingHoldSchedulerPort {
  abstract scheduleExpiry(bookingId: number, holdExpiresAt: Date): Promise<void>;
}
