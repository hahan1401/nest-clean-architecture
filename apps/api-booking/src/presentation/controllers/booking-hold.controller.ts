import { BOOKING_EXCHANGE, BOOKING_HOLD_EXPIRY_QUEUE, BOOKING_HOLD_PATTERNS } from '@app/common';
import { RabbitPayload, RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { Controller } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { ExpireBookingHoldService } from '../../application/usecases/maintenance.service';
import type { BookingHoldExpiryMessage } from '../../infrastructure/schedulers/rmq-booking-hold.scheduler';

/**
 * The other end of the delay. A message published when the booking was created
 * arrives here the moment its hold lapses, having sat out its `expiration` in
 * the delay queue.
 */
@Controller()
export class BookingHoldController {
  constructor(
    private readonly expireBookingHoldService: ExpireBookingHoldService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(BookingHoldController.name);
  }

  @RabbitSubscribe({
    exchange: BOOKING_EXCHANGE,
    routingKey: BOOKING_HOLD_PATTERNS.EXPIRE,
    queue: process.env.BOOKING_HOLD_EXPIRY_QUEUE || BOOKING_HOLD_EXPIRY_QUEUE,
    queueOptions: { durable: true },
  })
  async expire(@RabbitPayload() message: BookingHoldExpiryMessage): Promise<void> {
    const { bookingId } = message;

    if (typeof bookingId !== 'number') {
      // Malformed messages are dropped rather than retried: a redelivery loop
      // would keep a poison message in front of every real expiry behind it.
      this.logger.warn({ message }, 'Ignoring a hold expiry message with no bookingId');
      return;
    }

    const expired = await this.expireBookingHoldService.execute(bookingId);

    // Not expiring is the ordinary outcome for a booking that was confirmed in
    // time, so only the state change is worth a log line.
    if (expired) {
      this.logger.info({ bookingId }, 'Hold expired on schedule; the slot is free again');
    }
  }
}
