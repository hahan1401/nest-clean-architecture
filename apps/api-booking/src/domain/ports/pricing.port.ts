import type { PriceQuote, Room, Tour, TourDeparture } from '@app/database';
import type { DateRange } from '../models/date-range';

/**
 * Resolves what a stay or a seat block costs, from the base price plus whichever
 * PriceRule overrides apply. The returned quote is frozen onto the booking, so
 * later price edits never rewrite history.
 */
export abstract class PricingPort {
  abstract quoteRoomStay(room: Room, range: DateRange): Promise<PriceQuote>;
  abstract quoteTourSeats(tour: Tour, departure: TourDeparture, seats: number): Promise<PriceQuote>;
}
