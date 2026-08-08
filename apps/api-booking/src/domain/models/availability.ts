import type { PriceQuote, Room } from '@app/database';

export interface RoomAvailability {
  room: Room;
  available: boolean;
  /** Present only when `available` is true - there is no point pricing a taken room. */
  quote: PriceQuote | null;
}
