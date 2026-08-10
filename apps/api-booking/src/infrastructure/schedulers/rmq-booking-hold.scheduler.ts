import { BOOKING_EXCHANGE, BOOKING_HOLD_PATTERNS } from '@app/common';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { BookingHoldSchedulerPort } from '../../domain/ports/booking-hold-scheduler.port';

export type BookingHoldExpiryMessage = {
  bookingId: number;
  /** Carried for logging and for spotting a message that outlived its booking. */
  holdExpiresAt: string;
};

@Injectable()
export class RmqBookingHoldScheduler extends BookingHoldSchedulerPort {
  constructor(
    private readonly amqp: AmqpConnection,
    private readonly logger: PinoLogger,
  ) {
    super();
    this.logger.setContext(RmqBookingHoldScheduler.name);
  }

  async scheduleExpiry(bookingId: number, holdExpiresAt: Date): Promise<void> {
    // Measured now rather than assumed from config: what matters is the time
    // left on this specific hold, and the row is the authority on that.
    const delayMs = Math.max(holdExpiresAt.getTime() - Date.now(), 0);
    const message: BookingHoldExpiryMessage = {
      bookingId,
      holdExpiresAt: holdExpiresAt.toISOString(),
    };

    try {
      await this.amqp.publish(BOOKING_EXCHANGE, BOOKING_HOLD_PATTERNS.SCHEDULED, message, {
        // The delay itself. The message sits unconsumed in the delay queue for
        // this long, then the broker dead-letters it onto the expiry queue.
        expiration: String(delayMs),
        // Survives a broker restart; without this a bounce would strand the room
        // until the reconciliation sweep noticed.
        persistent: true,
        messageId: `hold-expiry-${bookingId}`,
      });
    } catch (error: unknown) {
      // Swallowed deliberately - see the port contract. The booking is committed
      // and the sweep is the safety net; refusing the sale here would be worse.
      this.logger.error(
        { err: error, bookingId, delayMs },
        'Could not schedule the hold expiry; the reconciliation sweep will catch it',
      );
    }
  }
}
