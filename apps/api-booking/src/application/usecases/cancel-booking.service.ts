import { ConflictError, NotFoundError } from '@app/common';
import { Booking, BookingStatus } from '@app/database';
import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { todayUtc } from '../../domain/models/date-range';
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
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(CancelBookingService.name);
  }

  async execute(input: CancelBookingInput): Promise<Booking> {
    const booking = await this.bookingRepository.findById(input.bookingId);
    if (!booking) {
      throw new NotFoundError(`Booking with id ${input.bookingId} not found`);
    }
    assertCancellable(booking, todayUtc());

    const cancelled = await this.bookingRepository.markCancelled(
      booking.id,
      new Date(),
      input.reason ?? null,
    );
    if (!cancelled) {
      throw new ConflictError(`Booking ${booking.reference} is no longer cancellable`);
    }

    this.logger.info(
      { bookingId: cancelled.id, reference: cancelled.reference },
      'Booking cancelled',
    );
    return cancelled;
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

    // Delegates to the same conditional transition as the admin path, so seat
    // release and idempotency behave identically however the cancel arrived.
    const cancelled = await this.bookingRepository.markCancelled(
      booking.id,
      new Date(),
      input.reason ?? 'Cancelled by customer',
    );
    if (!cancelled) {
      throw new ConflictError(`Booking ${booking.reference} is no longer cancellable`);
    }

    this.logger.info(
      { bookingId: cancelled.id, reference: cancelled.reference },
      'Booking cancelled by customer link',
    );
    return cancelled;
  }
}
