import { ConflictError, NotFoundError } from '@app/common';
import { Booking, BookingStatus } from '@app/database';
import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import type { BookingDetail } from '../../domain/models/booking-detail';
import { nightCount, todayUtc } from '../../domain/models/date-range';
import {
  BookingCancelledNotification,
  BookingNotifierPort,
} from '../../domain/ports/booking-notifier.port';
import { BookingRepository } from '../../domain/repositories/booking.repository';
import {
  CancelBookingByTokenInput,
  CancelBookingByTokenUseCase,
  CancelBookingInput,
  CancelBookingUseCase,
  GetBookingByCancellationTokenUseCase,
} from '../../domain/usecases/booking.usecase';

/**
 * Has the stay or departure already started? Once it has, the booking is a
 * historical fact and self-service cancellation stops being meaningful.
 */
const hasStarted = (booking: Booking, today: Date): boolean => {
  const start = booking.type === 'ROOM' ? booking.checkIn : null;
  return start != null && start <= today;
};

/**
 * Both cancel paths build the same announcement. `detail` is optional because the
 * labels are cosmetic: a missing lookup degrades "Garden Room" to "Room" rather
 * than costing the guest their cancellation email.
 */
const toCancelledNotification = (
  cancelled: Booking,
  detail: BookingDetail | null,
  cancelledBy: 'customer' | 'owner',
  // Passed in rather than read back off the row: markCancelled stores the reason
  // in `notes`, which otherwise holds the guest's own booking notes.
  reason: string | null,
  requestId?: string,
): BookingCancelledNotification => {
  const base = {
    bookingId: cancelled.id,
    reference: cancelled.reference,
    customerName: cancelled.customerName,
    customerEmail: cancelled.customerEmail,
    customerPhone: cancelled.customerPhone,
    totalAmount: cancelled.totalAmount,
    currency: cancelled.currency,
    cancelledAt: cancelled.cancelledAt ?? new Date(),
    reason,
    cancelledBy,
    requestId,
  };

  if (cancelled.type === 'ROOM' && cancelled.checkIn && cancelled.checkOut) {
    return {
      ...base,
      type: 'ROOM',
      roomName: detail?.roomName ?? 'Room',
      checkIn: cancelled.checkIn,
      checkOut: cancelled.checkOut,
      nights: nightCount({ from: cancelled.checkIn, to: cancelled.checkOut }),
      guests: cancelled.guests,
    };
  }

  return {
    ...base,
    type: 'TOUR',
    tourName: detail?.tourName ?? 'Tour',
    departureDate: detail?.departureDate ?? cancelled.createdAt,
    seats: cancelled.seats ?? cancelled.guests,
  };
};

const assertCancellable = (booking: Booking, today: Date): void => {
  if (booking.status === BookingStatus.CANCELLED || booking.status === BookingStatus.EXPIRED) {
    throw new ConflictError(
      `Booking ${booking.reference} is already ${booking.status.toLowerCase()}`,
    );
  }
  if (booking.status === BookingStatus.COMPLETED) {
    throw new ConflictError(`Booking ${booking.reference} has already been completed`);
  }
  if (hasStarted(booking, today)) {
    throw new ConflictError(
      `Booking ${booking.reference} has already started and can no longer be cancelled online`,
    );
  }
};

@Injectable()
export class CancelBookingService implements CancelBookingUseCase {
  constructor(
    private readonly bookingRepository: BookingRepository,
    private readonly notifier: BookingNotifierPort,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(CancelBookingService.name);
  }

  async execute(input: CancelBookingInput): Promise<Booking> {
    // findDetailedById rather than findById: same single query, and it carries the
    // room/tour labels the cancellation emails need.
    const detail = await this.bookingRepository.findDetailedById(input.bookingId);
    if (!detail) {
      throw new NotFoundError(`Booking with id ${input.bookingId} not found`);
    }

    const { booking } = detail;
    assertCancellable(booking, todayUtc());

    const reason = input.reason ?? null;
    const cancelled = await this.bookingRepository.markCancelled(booking.id, new Date(), reason);
    if (!cancelled) {
      throw new ConflictError(`Booking ${booking.reference} is no longer cancellable`);
    }

    this.logger.info(
      { bookingId: cancelled.id, reference: cancelled.reference },
      'Booking cancelled',
    );

    await this.announce(cancelled, detail, 'owner', reason, input.requestId);

    return cancelled;
  }

  /** Mirrors ConfirmBookingService: the transition is committed, so this can only log. */
  private async announce(
    cancelled: Booking,
    detail: BookingDetail | null,
    cancelledBy: 'customer' | 'owner',
    reason: string | null,
    requestId?: string,
  ): Promise<void> {
    await this.notifier
      .notifyBookingCancelled(
        toCancelledNotification(cancelled, detail, cancelledBy, reason, requestId),
      )
      .catch((error: unknown) => {
        this.logger.error(
          { err: error, bookingId: cancelled.id, reference: cancelled.reference },
          'Booking cancelled but the announcement could not be sent',
        );
      });
  }
}

/**
 * Read-only lookup behind the emailed cancel link. Deliberately changes nothing:
 * mail scanners and link-preview bots fetch every URL in a message, so the GET
 * side of the cancel flow must be safe to prefetch.
 */
@Injectable()
export class GetBookingByCancellationTokenService implements GetBookingByCancellationTokenUseCase {
  constructor(private readonly bookingRepository: BookingRepository) {}

  async execute(token: string): Promise<Booking> {
    const booking = await this.bookingRepository.findByCancellationToken(token);
    if (!booking) {
      // Same error as an unknown id on purpose: distinguishing the two would
      // turn this endpoint into an oracle for guessing valid tokens.
      throw new NotFoundError('Booking not found');
    }
    return booking;
  }
}

@Injectable()
export class CancelBookingByTokenService implements CancelBookingByTokenUseCase {
  constructor(
    private readonly bookingRepository: BookingRepository,
    private readonly notifier: BookingNotifierPort,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(CancelBookingByTokenService.name);
  }

  async execute(input: CancelBookingByTokenInput): Promise<Booking> {
    const booking = await this.bookingRepository.findByCancellationToken(input.token);
    if (!booking) {
      throw new NotFoundError('Booking not found');
    }
    assertCancellable(booking, todayUtc());

    // Two different values on purpose. The stored one is an audit trail and always
    // says something; the displayed one is only what the guest actually typed, so
    // the emails do not report "Reason: Cancelled by customer" next to a
    // "Cancelled by: Guest" row.
    const storedReason = input.reason ?? 'Cancelled by customer';
    const statedReason = input.reason?.trim() || null;

    // Delegates to the same conditional transition as the admin path, so seat
    // release and idempotency behave identically however the cancel arrived.
    const cancelled = await this.bookingRepository.markCancelled(
      booking.id,
      new Date(),
      storedReason,
    );
    if (!cancelled) {
      throw new ConflictError(`Booking ${booking.reference} is no longer cancellable`);
    }

    this.logger.info(
      { bookingId: cancelled.id, reference: cancelled.reference },
      'Booking cancelled by customer link',
    );

    // The token lookup returns a bare Booking, so the labels come from a second
    // read. It is not worth failing the announcement over: a null detail only
    // costs the email its room/tour name.
    const detail = await this.bookingRepository.findDetailedById(cancelled.id).catch(() => null);

    await this.notifier
      .notifyBookingCancelled(
        toCancelledNotification(cancelled, detail, 'customer', statedReason, input.requestId),
      )
      .catch((error: unknown) => {
        this.logger.error(
          { err: error, bookingId: cancelled.id, reference: cancelled.reference },
          'Booking cancelled but the announcement could not be sent',
        );
      });

    return cancelled;
  }
}
