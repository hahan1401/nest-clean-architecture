import { Injectable } from '@nestjs/common';
import { todayUtc } from '../../domain/models/date-range';
import { BookingRepository } from '../../domain/repositories/booking.repository';
import {
  CloseElapsedDeparturesUseCase,
  CompleteElapsedBookingsUseCase,
  ExpireStaleHoldsUseCase,
} from '../../domain/usecases/maintenance.usecase';

/**
 * The three maintenance jobs. Each delegates to a single atomic statement in the
 * repository, which is what makes them safe to run concurrently: every replica
 * of this service fires its own cron, and a second run simply matches no rows.
 *
 * `now` is injectable so the specs do not need a fake clock.
 */

@Injectable()
export class ExpireStaleHoldsService implements ExpireStaleHoldsUseCase {
  constructor(private readonly bookingRepository: BookingRepository) {}

  execute(now: Date = new Date()): Promise<number> {
    return this.bookingRepository.expireStaleHolds(now);
  }
}

@Injectable()
export class CloseElapsedDeparturesService implements CloseElapsedDeparturesUseCase {
  constructor(private readonly bookingRepository: BookingRepository) {}

  execute(now: Date = new Date()): Promise<number> {
    return this.bookingRepository.closeElapsedDepartures(todayUtc(now));
  }
}

@Injectable()
export class CompleteElapsedBookingsService implements CompleteElapsedBookingsUseCase {
  constructor(private readonly bookingRepository: BookingRepository) {}

  execute(now: Date = new Date()): Promise<number> {
    return this.bookingRepository.completeElapsedBookings(todayUtc(now));
  }
}
