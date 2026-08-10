import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { PinoLogger } from 'nestjs-pino';
import {
  CloseElapsedDeparturesService,
  CompleteElapsedBookingsService,
  ExpireStaleHoldsService,
} from '../../application/usecases/maintenance.service';

/**
 * Every minute, not every ten. A PENDING booking keeps holding its slot until
 * this sweep flips it to EXPIRED - SLOT_HOLDING_STATUSES includes PENDING, and
 * availability never looks at hold_expires_at - so the sweep interval is added
 * to every hold. At a 3 minute TTL, a ten minute sweep would block the room for
 * up to thirteen.
 */
const DEFAULT_HOLD_SWEEP_CRON = '* * * * *';
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
    private readonly expireStaleHoldsService: ExpireStaleHoldsService,
    private readonly closeElapsedDeparturesService: CloseElapsedDeparturesService,
    private readonly completeElapsedBookingsService: CompleteElapsedBookingsService,
    private readonly configService: ConfigService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(BookingMaintenanceScheduler.name);
  }

  /** Frees rooms and seats held by abandoned checkouts. */
  @Cron(process.env.HOLD_SWEEP_CRON || DEFAULT_HOLD_SWEEP_CRON, { name: 'expire-stale-holds' })
  async expireStaleHolds(): Promise<void> {
    const affected = await this.expireStaleHoldsService.execute();
    if (affected > 0) {
      this.logger.info({ affected }, 'Expired stale booking holds');
    }
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
