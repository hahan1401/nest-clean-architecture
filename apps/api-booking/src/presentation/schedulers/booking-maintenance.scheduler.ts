import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { PinoLogger } from 'nestjs-pino';
import {
  CloseElapsedDeparturesService,
  CompleteElapsedBookingsService,
} from '../../application/usecases/maintenance.service';

/**
 * Hold expiry is not here: a delayed message published when the booking is
 * created releases each hold at its own deadline (see RmqBookingHoldScheduler
 * and BookingHoldController). These two remain because they are genuinely
 * date-driven - nothing happens at booking time that could schedule them.
 */
const DEFAULT_DAILY_MAINTENANCE_CRON = '5 0 * * *';

/**
 * Inbound adapter for the clock. It lives in presentation for the same reason a
 * controller does: it is an entry point that invokes use cases and nothing else
 * - no business rules, no error handling.
 *
 * Every replica of this service runs its own cron. That is safe only because
 * each job is a single atomic conditional statement, so a second concurrent run
 * matches zero rows. Do not add a job here that reads and then writes without
 * re-checking the status in its WHERE clause.
 */
@Injectable()
export class BookingMaintenanceScheduler {
  constructor(
    private readonly closeElapsedDeparturesService: CloseElapsedDeparturesService,
    private readonly completeElapsedBookingsService: CompleteElapsedBookingsService,
    private readonly configService: ConfigService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(BookingMaintenanceScheduler.name);
  }

  /** Closes departures whose date has passed, so a past date can never be sold. */
  @Cron(process.env.DAILY_MAINTENANCE_CRON || DEFAULT_DAILY_MAINTENANCE_CRON, {
    name: 'close-elapsed-departures',
  })
  async closeElapsedDepartures(): Promise<void> {
    const affected = await this.closeElapsedDeparturesService.execute();
    if (affected > 0) {
      this.logger.info({ affected }, 'Closed elapsed tour departures');
    }
  }

  /** Moves finished stays and departures to their terminal COMPLETED state. */
  @Cron(process.env.DAILY_MAINTENANCE_CRON || DEFAULT_DAILY_MAINTENANCE_CRON, {
    name: 'complete-elapsed-bookings',
  })
  async completeElapsedBookings(): Promise<void> {
    const affected = await this.completeElapsedBookingsService.execute();
    if (affected > 0) {
      this.logger.info({ affected }, 'Completed elapsed bookings');
    }
  }
}
