import type { Booking, BookingStatus, PriceQuote } from '@app/database';
import type { BookingDetail } from '../models/booking-detail';
import type { DateRange } from '../models/date-range';
import type { ListRange } from '../models/pagination';

export interface BookingCustomerData {
  name: string;
  email: string;
  phone: string;
}

interface CreateBookingCommon {
  reference: string;
  cancellationToken: string;
  guests: number;
  customer: BookingCustomerData;
  notes: string | null;
  quote: PriceQuote;
  holdExpiresAt: Date;
}

export interface CreateRoomBookingData extends CreateBookingCommon {
  roomId: number;
  range: DateRange;
}

export interface CreateTourBookingData extends CreateBookingCommon {
  tourDepartureId: number;
  seats: number;
}

export interface BookingHistoryFilter extends ListRange {
  status?: BookingStatus;
  /** Optional window over stay dates (rooms) or departure dates (tours). */
  range?: DateRange;
}

export abstract class BookingRepository {
  /**
   * Inserts a PENDING room booking together with its frozen price lines, in one
   * transaction. Returns null when another booking took the range first - the
   * bookings_room_no_overlap exclusion constraint is the arbiter, so this is the
   * lost-race signal, not an availability opinion.
   */
  abstract createRoomBooking(data: CreateRoomBookingData): Promise<Booking | null>;

  /**
   * Inserts a PENDING tour booking and consumes `seats` on the departure in one
   * transaction. Returns null when the remaining seats no longer cover the
   * request or the departure is not OPEN.
   */
  abstract createTourBooking(data: CreateTourBookingData): Promise<Booking | null>;

  abstract findById(id: number): Promise<Booking | null>;
  abstract findByReference(reference: string): Promise<Booking | null>;
  abstract findByCancellationToken(token: string): Promise<Booking | null>;

  /** Booking plus the labels the confirmation emails need, in one query. */
  abstract findDetailedById(id: number): Promise<BookingDetail | null>;

  abstract findByRoom(roomId: number, filter: BookingHistoryFilter): Promise<Booking[]>;
  abstract findByTour(tourId: number, filter: BookingHistoryFilter): Promise<Booking[]>;

  /**
   * Conditional PENDING -> CONFIRMED. Returns null when the row was not PENDING.
   * That row count, not any preceding read, is the idempotency guard that makes
   * the confirmation emails fire exactly once under concurrent confirms.
   */
  abstract markConfirmed(id: number, confirmedAt: Date): Promise<Booking | null>;

  /**
   * Conditional -> CANCELLED, releasing tour seats in the same transaction.
   * Returns null when the booking was already in a terminal state.
   */
  abstract markCancelled(
    id: number,
    cancelledAt: Date,
    reason: string | null,
  ): Promise<Booking | null>;

  /**
   * One booking's hold -> EXPIRED, returning its seats. False when it did not
   * apply, which is the normal outcome for a booking that was confirmed or
   * cancelled before its hold ran out, or whose hold was pushed back.
   */
  abstract expireHold(bookingId: number, now: Date): Promise<boolean>;

  /** OPEN departures that have already left -> CLOSED. */
  abstract closeElapsedDepartures(now: Date): Promise<number>;

  /** CONFIRMED bookings whose stay or departure has elapsed -> COMPLETED. */
  abstract completeElapsedBookings(now: Date): Promise<number>;
}
