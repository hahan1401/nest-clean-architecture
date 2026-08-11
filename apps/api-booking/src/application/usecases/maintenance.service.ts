import { Injectable } from '@nestjs/common';
import { BookingRepository } from '../../domain/repositories/booking.repository';
import {
  CloseElapsedDeparturesUseCase,
  CompleteElapsedBookingsUseCase,
  ExpireBookingHoldUseCase,
} from '../../domain/usecases/maintenance.usecase';

/**
 * Each delegates to a single atomic statement in the repository, which is what
 * makes them safe to run concurrently: every replica of this service fires its
 * own cron, and a second run simply matches no rows.
 *
 * `now` is injectable so the specs do not need a fake clock.
 */

/**
 * Releases one booking's hold, driven by the delayed message rather than a poll.
 *
 * The message is a prompt to look, not permission to expire: the repository
 * re-checks status and hold_expires_at in the same statement, so a booking
 * confirmed moments earlier survives, and a redelivery is a no-op.
 */
@Injectable()
export class ExpireBookingHoldService implements ExpireBookingHoldUseCase {
  constructor(private readonly bookingRepository: BookingRepository) {}

  execute(bookingId: number, now: Date = new Date()): Promise<boolean> {
    return this.bookingRepository.expireHold(bookingId, now);
  }
}

/**
 * `now` goes to the repository as the instant it is. Departures and stays carry
 * a time of day now, so "has it elapsed?" is a straight instant comparison and
 * no longer needs rounding to a day - which also retires the timezone skew the
 * old midnight-based version had in a UTC+7 deployment.
 */
@Injectable()
export class CloseElapsedDeparturesService implements CloseElapsedDeparturesUseCase {
  constructor(private readonly bookingRepository: BookingRepository) {}

  execute(now: Date = new Date()): Promise<number> {
    return this.bookingRepository.closeElapsedDepartures(now);
  }
}

@Injectable()
export class CompleteElapsedBookingsService implements CompleteElapsedBookingsUseCase {
  constructor(private readonly bookingRepository: BookingRepository) {}

  execute(now: Date = new Date()): Promise<number> {
    return this.bookingRepository.completeElapsedBookings(now);
  }
}
