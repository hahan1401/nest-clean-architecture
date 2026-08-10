import type { PriceQuote, Room } from '@app/database';

/**
 * Why a room can or cannot be taken for a window.
 *
 * ON_HOLD is the interesting one: someone else is mid-checkout, so the room is
 * not bookable *now* but is not sold either. Callers show it with its
 * `heldUntil` so a guest can come back, instead of hiding it as if it were gone.
 */
export type RoomAvailabilityState = 'AVAILABLE' | 'ON_HOLD' | 'BOOKED';

export interface RoomAvailability {
  room: Room;
  state: RoomAvailabilityState;
  /**
   * When the hold blocking this room lapses. Set only for ON_HOLD, and null even
   * then if the pending booking somehow carries no expiry.
   */
  heldUntil: Date | null;
  /**
   * Priced for AVAILABLE and ON_HOLD - a guest deciding whether to wait out a
   * hold needs to know what they would be waiting for. Null for BOOKED.
   */
  quote: PriceQuote | null;
}

/** What `findAvailable` reports per room before pricing. */
export interface RoomOffer {
  room: Room;
  /** Null when the room is free; set when a pending booking is holding it. */
  heldUntil: Date | null;
  held: boolean;
}
