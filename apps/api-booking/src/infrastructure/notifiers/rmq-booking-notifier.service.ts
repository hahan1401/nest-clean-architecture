import { EMAIL_PATTERNS, EMAIL_SERVICE, SendEmailDto } from '@app/common';
import { Inject, Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientProxy } from '@nestjs/microservices';
import { PinoLogger } from 'nestjs-pino';
import { lastValueFrom, timeout } from 'rxjs';
import {
  BookingCancelledNotification,
  BookingConfirmedNotification,
  BookingNotifierPort,
} from '../../domain/ports/booking-notifier.port';
import {
  BookingEmailContent,
  customerBookingCancelledEmail,
  customerBookingConfirmedEmail,
  ownerBookingCancelledEmail,
  ownerBookingConfirmedEmail,
} from '../templates/booking-emails';

const DEFAULT_EMIT_TIMEOUT_MS = 2_000;

/** Which mailer consumes these events; the routing key is the only difference. */
const EMAIL_ROUTING_KEY_BY_PROVIDER: Record<string, string> = {
  ses: EMAIL_PATTERNS.SEND,
  gmail: EMAIL_PATTERNS.SEND_GMAIL,
};

@Injectable()
export class RmqBookingNotifierService
  extends BookingNotifierPort
  implements OnApplicationBootstrap
{
  private readonly ownerEmail: string;
  private readonly emitTimeoutMs: number;
  /** Resolved once from EMAIL_PROVIDER; changing it needs a restart, not just an env edit. */
  private readonly emailRoutingKey: string;

  constructor(
    @Inject(EMAIL_SERVICE) private readonly emailClient: ClientProxy,
    private readonly configService: ConfigService,
    private readonly logger: PinoLogger,
  ) {
    super();
    this.logger.setContext(RmqBookingNotifierService.name);
    // getOrThrow in the constructor: a missing owner address crashes at boot,
    // not at 2am on the first confirmed booking.
    this.ownerEmail = this.configService.getOrThrow<string>('HOMESTAY_OWNER_EMAIL');
    this.emitTimeoutMs =
      Number(this.configService.get<number>('EMAIL_EMIT_TIMEOUT_MS')) || DEFAULT_EMIT_TIMEOUT_MS;

    // An unknown provider would publish to a routing key nothing consumes, and the
    // messages would vanish silently on the exchange. Fail at boot instead.
    const provider = (this.configService.get<string>('EMAIL_PROVIDER') || 'ses')
      .trim()
      .toLowerCase();
    const routingKey = EMAIL_ROUTING_KEY_BY_PROVIDER[provider];

    if (!routingKey) {
      throw new Error(
        `Unknown EMAIL_PROVIDER "${provider}", expected one of: ${Object.keys(
          EMAIL_ROUTING_KEY_BY_PROVIDER,
        ).join(', ')}`,
      );
    }

    this.emailRoutingKey = routingKey;
  }

  /**
   * Warm the AMQP connection at boot so a bad RABBITMQ_URL shows up in the
   * startup logs rather than as a mysteriously slow first confirmation.
   *
   * Bounded and non-fatal: connect() never settles while the broker is down, so
   * it races a timer, and a failure only warns. The service is still useful
   * without email - refusing to boot would take bookings down with the mailer.
   */
  async onApplicationBootstrap(): Promise<void> {
    const timer = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error('Timed out connecting to the email broker')),
        this.emitTimeoutMs,
      ).unref(),
    );

    try {
      await Promise.race([this.emailClient.connect(), timer]);
    } catch (error: unknown) {
      this.logger.warn({ err: error }, 'Email broker not reachable at boot; will retry on demand');
    }
  }

  async notifyBookingConfirmed(notification: BookingConfirmedNotification): Promise<void> {
    const owner = ownerBookingConfirmedEmail(notification);
    const customer = customerBookingConfirmedEmail(notification);

    // The two recipients are independent: one failing must not skip the other.
    await Promise.all([
      this.queue('owner', notification, [this.ownerEmail], owner),
      this.queue('customer', notification, [notification.customerEmail], customer, [
        this.ownerEmail,
      ]),
    ]);
  }

  async notifyBookingCancelled(notification: BookingCancelledNotification): Promise<void> {
    const owner = ownerBookingCancelledEmail(notification);
    const customer = customerBookingCancelledEmail(notification);

    await Promise.all([
      this.queue('owner', notification, [this.ownerEmail], owner),
      this.queue('customer', notification, [notification.customerEmail], customer, [
        this.ownerEmail,
      ]),
    ]);
  }

  private async queue(
    recipient: 'owner' | 'customer',
    notification: BookingConfirmedNotification | BookingCancelledNotification,
    to: string[],
    content: BookingEmailContent,
    replyTo?: string[],
  ): Promise<void> {
    // `from` is left unset on purpose: the mailer falls back to its own sender
    // (EMAIL_FROM for api-email, GMAIL_SENDER for api-gmail), so the verified
    // identity stays configured in exactly one place per provider.
    const payload: SendEmailDto = {
      to,
      replyTo,
      subject: content.subject,
      text: content.text,
      html: content.html,
      requestId: notification.requestId,
    };

    const context = {
      bookingId: notification.bookingId,
      reference: notification.reference,
      recipient,
      requestId: notification.requestId,
    };

    try {
      // The timeout is load-bearing. ClientProxy.emit() starts with a connect(),
      // and amqp-connection-manager retries a dead broker forever - the promise
      // simply never settles. Without this, a RabbitMQ outage would turn
      // confirm_booking into a hung RPC: confirmed in Postgres, but the caller
      // never gets a response.
      await lastValueFrom(
        this.emailClient
          .emit(this.emailRoutingKey, payload)
          .pipe(timeout({ each: this.emitTimeoutMs })),
      );
      this.logger.info(context, 'Booking confirmation email queued');
    } catch (error: unknown) {
      // Swallowed deliberately - see the BookingNotifierPort contract. The
      // booking is already CONFIRMED in Postgres and must stay that way; this is
      // the fallback, not an error remap.
      this.logger.error({ ...context, err: error }, 'Failed to queue booking confirmation email');
    }
  }
}
