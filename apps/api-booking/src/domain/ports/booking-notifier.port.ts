export interface BookingNotificationBase {
  bookingId: number;
  reference: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  totalAmount: number;
  currency: string;
  confirmedAt: Date;
  /**
   * Finished URL, not a raw token: building it is the adapter's job, so
   * PUBLIC_BASE_URL never leaks into the application layer.
   */
  cancelUrl: string;
  requestId?: string;
}

/**
 * A discriminated union rather than one interface with optional fields, so the
 * templates narrow without non-null assertions (which eslint bans here).
 */
export type BookingConfirmedNotification =
  | (BookingNotificationBase & {
      type: 'ROOM';
      roomName: string;
      checkIn: Date;
      checkOut: Date;
      nights: number;
      guests: number;
    })
  | (BookingNotificationBase & {
      type: 'TOUR';
      tourName: string;
      departureDate: Date;
      seats: number;
    });

/**
 * Outbound port: announces a confirmed booking to the homestay owner and to the
 * customer.
 *
 * Contract - read before implementing:
 *  - Delivery is BEST EFFORT. Implementations MUST resolve even when the
 *    transport is unreachable, and MUST NOT throw. A confirmed booking is never
 *    rolled back because an email could not be queued.
 *  - Implementations own the failure logging (structured, via PinoLogger).
 *  - Implementations must be bounded in time; the caller is a synchronous RPC
 *    handler and a hung broker would hang the whole request.
 */
export abstract class BookingNotifierPort {
  abstract notifyBookingConfirmed(notification: BookingConfirmedNotification): Promise<void>;
}
