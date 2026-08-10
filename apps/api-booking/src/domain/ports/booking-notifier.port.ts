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
 * What was booked. A discriminated union rather than one interface with optional
 * fields, so the templates narrow without non-null assertions (which eslint bans
 * here). Shared by every notification, since "what was booked" does not change
 * with the reason for writing.
 */
export type BookingSubject =
  | {
      type: 'ROOM';
      roomName: string;
      checkIn: Date;
      checkOut: Date;
      nights: number;
      guests: number;
    }
  | {
      type: 'TOUR';
      tourName: string;
      departureDate: Date;
      seats: number;
    };

export type BookingConfirmedNotification = BookingNotificationBase &
  BookingSubject & {
    /**
     * The guest's own requests, straight from the booking. Not on the cancelled
     * notification: markCancelled overwrites `notes` with the cancellation
     * reason, so the field no longer means "what the guest asked for".
     */
    notes: string | null;
  };

/**
 * Cancellation drops `cancelUrl` (the token is spent) and `confirmedAt` (a
 * PENDING hold can be cancelled before it was ever confirmed).
 */
export type BookingCancelledNotification = Omit<
  BookingNotificationBase,
  'cancelUrl' | 'confirmedAt'
> & {
  cancelledAt: Date;
  reason: string | null;
  /** Which path cancelled it, so the owner mail can say who acted. */
  cancelledBy: 'customer' | 'owner';
} & BookingSubject;

/**
 * Outbound port: announces booking lifecycle events to the homestay owner and to
 * the customer.
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

  /** Same best-effort contract: a cancellation is committed whether or not the mail goes out. */
  abstract notifyBookingCancelled(notification: BookingCancelledNotification): Promise<void>;
}
