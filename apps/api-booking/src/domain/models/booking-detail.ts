import type { Booking } from '@app/database';

/**
 * A booking plus the human-readable labels the confirmation emails need,
 * fetched in one query so the notifier never has to go back to the database.
 */
export interface BookingDetail {
  booking: Booking;
  roomName: string | null;
  tourName: string | null;
  departureDate: Date | null;
}
