import { ConflictError, NotFoundError } from '@app/common';
import { Booking, BookingStatus } from '@app/database';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { BookingDetail } from '../../domain/models/booking-detail';
import { BookingNotifierPort } from '../../domain/ports/booking-notifier.port';
import { BookingRepository } from '../../domain/repositories/booking.repository';
import { ConfirmBookingService } from './confirm-booking.service';

const booking = (overrides: Partial<Booking> = {}): Booking =>
  new Booking({
    id: 1,
    reference: 'BK-7F3K9Q2A',
    cancellationToken: 'tok-abc',
    type: 'ROOM',
    status: BookingStatus.PENDING,
    roomId: 1,
    checkIn: new Date('2027-02-13'),
    checkOut: new Date('2027-02-16'),
    guests: 2,
    customerName: 'Tran Thi B',
    customerEmail: 'guest@example.com',
    customerPhone: '0900000000',
    totalAmount: 3_900_000,
    currency: 'VND',
    createdAt: new Date('2027-01-01'),
    updatedAt: new Date('2027-01-01'),
    ...overrides,
  });

const detail = (overrides: Partial<Booking> = {}): BookingDetail => ({
  booking: booking(overrides),
  roomName: 'Garden Room',
  tourName: null,
  departureDate: null,
});

describe('ConfirmBookingService', () => {
  let bookingRepository: jest.Mocked<BookingRepository>;
  let notifier: jest.Mocked<BookingNotifierPort>;
  let configService: jest.Mocked<ConfigService>;
  let logger: jest.Mocked<PinoLogger>;
  let service: ConfirmBookingService;

  beforeEach(() => {
    bookingRepository = {
      findDetailedById: jest.fn(),
      markConfirmed: jest.fn(),
    } as unknown as jest.Mocked<BookingRepository>;
    notifier = { notifyBookingConfirmed: jest.fn().mockResolvedValue(undefined) };
    configService = {
      getOrThrow: jest.fn().mockReturnValue('http://localhost:3000/'),
    } as unknown as jest.Mocked<ConfigService>;
    logger = {
      setContext: jest.fn(),
      info: jest.fn(),
      error: jest.fn(),
    } as unknown as jest.Mocked<PinoLogger>;

    service = new ConfirmBookingService(bookingRepository, notifier, configService, logger);
  });

  it('throws NotFound and sends nothing when the booking does not exist', async () => {
    bookingRepository.findDetailedById.mockResolvedValue(null);

    await expect(service.execute({ bookingId: 999 })).rejects.toBeInstanceOf(NotFoundError);
    expect(bookingRepository.markConfirmed).not.toHaveBeenCalled();
    expect(notifier.notifyBookingConfirmed).not.toHaveBeenCalled();
  });

  it('throws Conflict and sends nothing when the booking is already confirmed', async () => {
    bookingRepository.findDetailedById.mockResolvedValue(
      detail({ status: BookingStatus.CONFIRMED }),
    );

    await expect(service.execute({ bookingId: 1 })).rejects.toBeInstanceOf(ConflictError);
    expect(notifier.notifyBookingConfirmed).not.toHaveBeenCalled();
  });

  it('throws Conflict and sends nothing when the booking is cancelled', async () => {
    bookingRepository.findDetailedById.mockResolvedValue(
      detail({ status: BookingStatus.CANCELLED }),
    );

    await expect(service.execute({ bookingId: 1 })).rejects.toBeInstanceOf(ConflictError);
    expect(notifier.notifyBookingConfirmed).not.toHaveBeenCalled();
  });

  it('commits the status change BEFORE announcing it', async () => {
    bookingRepository.findDetailedById.mockResolvedValue(detail());
    bookingRepository.markConfirmed.mockResolvedValue(
      booking({ status: BookingStatus.CONFIRMED, confirmedAt: new Date('2027-01-05') }),
    );

    await service.execute({ bookingId: 1 });

    // Ordering is the whole point: the broker must never be able to influence
    // a row that has not been committed yet.
    const confirmOrder = bookingRepository.markConfirmed.mock.invocationCallOrder[0];
    const notifyOrder = notifier.notifyBookingConfirmed.mock.invocationCallOrder[0];
    expect(confirmOrder).toBeLessThan(notifyOrder);
  });

  it('throws Conflict and sends no email when it loses the confirm race', async () => {
    bookingRepository.findDetailedById.mockResolvedValue(detail());
    // The conditional UPDATE matched no rows: another request confirmed first.
    bookingRepository.markConfirmed.mockResolvedValue(null);

    await expect(service.execute({ bookingId: 1 })).rejects.toBeInstanceOf(ConflictError);
    expect(notifier.notifyBookingConfirmed).not.toHaveBeenCalled();
  });

  it('still returns the confirmed booking when the notifier rejects', async () => {
    bookingRepository.findDetailedById.mockResolvedValue(detail());
    bookingRepository.markConfirmed.mockResolvedValue(booking({ status: BookingStatus.CONFIRMED }));
    // Guards against a future notifier that breaks the never-throw contract.
    // The row is already CONFIRMED; answering with an error would send the
    // customer to retry straight into a 409.
    notifier.notifyBookingConfirmed.mockRejectedValue(new Error('broker down'));

    const result = await service.execute({ bookingId: 1 });

    expect(result.status).toBe(BookingStatus.CONFIRMED);
    expect(logger.error).toHaveBeenCalled();
  });

  it('builds a notification carrying the reference, total and cancel link', async () => {
    bookingRepository.findDetailedById.mockResolvedValue(detail());
    bookingRepository.markConfirmed.mockResolvedValue(
      booking({ status: BookingStatus.CONFIRMED, confirmedAt: new Date('2027-01-05') }),
    );

    await service.execute({ bookingId: 1, requestId: 'req-1' });

    expect(notifier.notifyBookingConfirmed).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ROOM',
        reference: 'BK-7F3K9Q2A',
        roomName: 'Garden Room',
        nights: 3,
        totalAmount: 3_900_000,
        customerEmail: 'guest@example.com',
        // Trailing slash on PUBLIC_BASE_URL must not produce "//bookings".
        cancelUrl: 'http://localhost:3000/bookings/cancel/tok-abc',
        requestId: 'req-1',
      }),
    );
  });
});
