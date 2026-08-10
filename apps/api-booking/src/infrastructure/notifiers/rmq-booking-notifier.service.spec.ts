import { EMAIL_PATTERNS, SendEmailDto } from '@app/common';
import { ConfigService } from '@nestjs/config';
import { ClientProxy } from '@nestjs/microservices';
import { PinoLogger } from 'nestjs-pino';
import { NEVER, of, throwError } from 'rxjs';
import { BookingConfirmedNotification } from '../../domain/ports/booking-notifier.port';
import { RmqBookingNotifierService } from './rmq-booking-notifier.service';

const OWNER_EMAIL = 'owner@example.com';

const notification: BookingConfirmedNotification = {
  bookingId: 1,
  reference: 'BK-7F3K9Q2A',
  customerName: 'Tran Thi B',
  customerEmail: 'guest@example.com',
  customerPhone: '0900000000',
  totalAmount: 3_900_000,
  currency: 'VND',
  confirmedAt: new Date('2027-01-05T10:00:00.000Z'),
  cancelUrl: 'http://localhost:3000/bookings/cancel/abc123',
  requestId: 'req-1',
  type: 'ROOM',
  roomName: 'Garden Room',
  checkIn: new Date('2027-02-13'),
  checkOut: new Date('2027-02-16'),
  nights: 3,
  guests: 2,
};

describe('RmqBookingNotifierService', () => {
  let emailClient: jest.Mocked<ClientProxy>;
  let configService: jest.Mocked<ConfigService>;
  let logger: jest.Mocked<PinoLogger>;
  let emailProvider: string | undefined;

  const build = (): RmqBookingNotifierService =>
    new RmqBookingNotifierService(emailClient, configService, logger);

  beforeEach(() => {
    emailProvider = undefined;
    emailClient = { emit: jest.fn(), connect: jest.fn() } as unknown as jest.Mocked<ClientProxy>;
    configService = {
      getOrThrow: jest.fn().mockReturnValue(OWNER_EMAIL),
      get: jest.fn((key: string) => (key === 'EMAIL_PROVIDER' ? emailProvider : 50)),
    } as unknown as jest.Mocked<ConfigService>;
    logger = {
      setContext: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as unknown as jest.Mocked<PinoLogger>;
  });

  it('queues one email to the owner and one to the customer', async () => {
    emailClient.emit.mockReturnValue(of(undefined));

    await build().notifyBookingConfirmed(notification);

    expect(emailClient.emit).toHaveBeenCalledTimes(2);

    const [ownerCall, customerCall] = emailClient.emit.mock.calls;
    expect(ownerCall[0]).toBe(EMAIL_PATTERNS.SEND);
    expect((ownerCall[1] as SendEmailDto).to).toEqual([OWNER_EMAIL]);
    expect((customerCall[1] as SendEmailDto).to).toEqual(['guest@example.com']);
  });

  it('routes to api-gmail when EMAIL_PROVIDER is gmail', async () => {
    emailProvider = 'gmail';
    emailClient.emit.mockReturnValue(of(undefined));

    await build().notifyBookingConfirmed(notification);

    expect(emailClient.emit).toHaveBeenCalledTimes(2);
    emailClient.emit.mock.calls.forEach((call) => expect(call[0]).toBe(EMAIL_PATTERNS.SEND_GMAIL));
  });

  it('ignores case and padding on EMAIL_PROVIDER', async () => {
    emailProvider = '  GMAIL  ';
    emailClient.emit.mockReturnValue(of(undefined));

    await build().notifyBookingConfirmed(notification);

    expect(emailClient.emit.mock.calls[0][0]).toBe(EMAIL_PATTERNS.SEND_GMAIL);
  });

  it('refuses to boot on an unknown EMAIL_PROVIDER rather than publishing into the void', () => {
    emailProvider = 'sendgrid';

    expect(() => build()).toThrow(/Unknown EMAIL_PROVIDER "sendgrid"/);
  });

  it('forwards the requestId and leaves `from` unset so api-email applies EMAIL_FROM', async () => {
    emailClient.emit.mockReturnValue(of(undefined));

    await build().notifyBookingConfirmed(notification);

    const payload = emailClient.emit.mock.calls[0][1] as SendEmailDto;
    expect(payload.requestId).toBe('req-1');
    expect(payload.from).toBeUndefined();
  });

  it('resolves and logs instead of throwing when the broker rejects', async () => {
    emailClient.emit.mockReturnValue(throwError(() => new Error('broker down')));

    // The port contract says this must never throw: a confirmed booking is not
    // rolled back because an email could not be queued.
    await expect(build().notifyBookingConfirmed(notification)).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledTimes(2);
  });

  it('resolves when the emit observable never settles, via the timeout', async () => {
    // NEVER models amqp-connection-manager waiting forever on a dead broker.
    emailClient.emit.mockReturnValue(NEVER);

    await expect(build().notifyBookingConfirmed(notification)).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledTimes(2);
  });

  it('still queues the customer email when the owner email fails', async () => {
    emailClient.emit
      .mockReturnValueOnce(throwError(() => new Error('owner failed')))
      .mockReturnValueOnce(of(undefined));

    await build().notifyBookingConfirmed(notification);

    expect(emailClient.emit).toHaveBeenCalledTimes(2);
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ recipient: 'customer' }),
      expect.any(String),
    );
  });

  it('queues a cancellation to both parties on the configured provider', async () => {
    emailProvider = 'gmail';
    emailClient.emit.mockReturnValue(of(undefined));

    await build().notifyBookingCancelled({
      bookingId: 1,
      reference: 'BK-7F3K9Q2A',
      customerName: 'Tran Thi B',
      customerEmail: 'guest@example.com',
      customerPhone: '0900000000',
      totalAmount: 3_900_000,
      currency: 'VND',
      cancelledAt: new Date('2027-01-06T09:00:00.000Z'),
      reason: 'plans changed',
      cancelledBy: 'customer',
      requestId: 'req-2',
      type: 'ROOM',
      roomName: 'Garden Room',
      checkIn: new Date('2027-02-13'),
      checkOut: new Date('2027-02-16'),
      nights: 3,
      guests: 2,
    });

    expect(emailClient.emit).toHaveBeenCalledTimes(2);

    const [ownerCall, customerCall] = emailClient.emit.mock.calls;
    expect(ownerCall[0]).toBe(EMAIL_PATTERNS.SEND_GMAIL);
    expect((ownerCall[1] as SendEmailDto).to).toEqual([OWNER_EMAIL]);
    expect((ownerCall[1] as SendEmailDto).subject).toContain('Booking cancelled BK-7F3K9Q2A');
    expect((customerCall[1] as SendEmailDto).to).toEqual(['guest@example.com']);
    expect((customerCall[1] as SendEmailDto).subject).toContain('cancelled');
    // The token is spent - re-offering the cancel link would only produce a 409.
    expect((customerCall[1] as SendEmailDto).text).not.toContain('/bookings/cancel/');
  });

  it('reads the owner address with getOrThrow so a missing value fails at boot', () => {
    emailClient.emit.mockReturnValue(of(undefined));

    build();

    expect(configService.getOrThrow).toHaveBeenCalledWith('HOMESTAY_OWNER_EMAIL');
  });
});
