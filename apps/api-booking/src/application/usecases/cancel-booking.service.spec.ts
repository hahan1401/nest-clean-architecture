import { ConflictError, NotFoundError } from '@app/common';
import { Booking, BookingStatus } from '@app/database';
import { PinoLogger } from 'nestjs-pino';
import { BookingRepository } from '../../domain/repositories/booking.repository';
import {
  CancelBookingByTokenService,
  CancelBookingService,
  GetBookingByCancellationTokenService,
} from './cancel-booking.service';

const TOKEN = 'a'.repeat(64);

const booking = (overrides: Partial<Booking> = {}): Booking =>
  new Booking({
    id: 1,
    reference: 'BK-7F3K9Q2A',
    cancellationToken: TOKEN,
    type: 'ROOM',
    status: BookingStatus.CONFIRMED,
    roomId: 1,
    // Far future so the "already started" guard does not fire by default.
    checkIn: new Date('2099-02-13'),
    checkOut: new Date('2099-02-16'),
    guests: 2,
    customerName: 'Tran Thi B',
    customerEmail: 'guest@example.com',
    customerPhone: '0900000000',
    totalAmount: 1_950_000,
    currency: 'VND',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

describe('CancelBookingService', () => {
  let bookingRepository: jest.Mocked<BookingRepository>;
  let logger: jest.Mocked<PinoLogger>;
  let service: CancelBookingService;

  beforeEach(() => {
    bookingRepository = {
      findById: jest.fn(),
      markCancelled: jest.fn(),
    } as unknown as jest.Mocked<BookingRepository>;
    logger = { setContext: jest.fn(), info: jest.fn() } as unknown as jest.Mocked<PinoLogger>;
    service = new CancelBookingService(bookingRepository, logger);
  });

  it('throws NotFound for an unknown booking', async () => {
    bookingRepository.findById.mockResolvedValue(null);

    await expect(service.execute({ bookingId: 999 })).rejects.toBeInstanceOf(NotFoundError);
  });

  it('cancels a confirmed booking', async () => {
    bookingRepository.findById.mockResolvedValue(booking());
    bookingRepository.markCancelled.mockResolvedValue(booking({ status: BookingStatus.CANCELLED }));

    const result = await service.execute({ bookingId: 1, reason: 'plans changed' });

    expect(result.status).toBe(BookingStatus.CANCELLED);
    expect(bookingRepository.markCancelled).toHaveBeenCalledWith(
      1,
      expect.any(Date),
      'plans changed',
    );
  });

  it('throws Conflict on a second cancel', async () => {
    bookingRepository.findById.mockResolvedValue(booking({ status: BookingStatus.CANCELLED }));

    await expect(service.execute({ bookingId: 1 })).rejects.toBeInstanceOf(ConflictError);
    expect(bookingRepository.markCancelled).not.toHaveBeenCalled();
  });

  it('throws Conflict for a completed booking', async () => {
    bookingRepository.findById.mockResolvedValue(booking({ status: BookingStatus.COMPLETED }));

    await expect(service.execute({ bookingId: 1 })).rejects.toBeInstanceOf(ConflictError);
  });

  it('throws Conflict when it loses the race to the conditional update', async () => {
    bookingRepository.findById.mockResolvedValue(booking());
    bookingRepository.markCancelled.mockResolvedValue(null);

    await expect(service.execute({ bookingId: 1 })).rejects.toBeInstanceOf(ConflictError);
  });
});

describe('GetBookingByCancellationTokenService', () => {
  let bookingRepository: jest.Mocked<BookingRepository>;
  let service: GetBookingByCancellationTokenService;

  beforeEach(() => {
    bookingRepository = {
      findByCancellationToken: jest.fn(),
      markCancelled: jest.fn(),
    } as unknown as jest.Mocked<BookingRepository>;
    service = new GetBookingByCancellationTokenService(bookingRepository);
  });

  it('is read-only - a mail scanner prefetching the link changes nothing', async () => {
    bookingRepository.findByCancellationToken.mockResolvedValue(booking());

    await service.execute(TOKEN);

    expect(bookingRepository.markCancelled).not.toHaveBeenCalled();
  });

  it('throws a plain NotFound for an unknown token, giving nothing away', async () => {
    bookingRepository.findByCancellationToken.mockResolvedValue(null);

    await expect(service.execute('wrong')).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.execute('wrong')).rejects.toThrow('Booking not found');
  });
});

describe('CancelBookingByTokenService', () => {
  let bookingRepository: jest.Mocked<BookingRepository>;
  let logger: jest.Mocked<PinoLogger>;
  let service: CancelBookingByTokenService;

  beforeEach(() => {
    bookingRepository = {
      findByCancellationToken: jest.fn(),
      markCancelled: jest.fn(),
    } as unknown as jest.Mocked<BookingRepository>;
    logger = { setContext: jest.fn(), info: jest.fn() } as unknown as jest.Mocked<PinoLogger>;
    service = new CancelBookingByTokenService(bookingRepository, logger);
  });

  it('cancels through the same conditional transition as the admin path', async () => {
    bookingRepository.findByCancellationToken.mockResolvedValue(booking());
    bookingRepository.markCancelled.mockResolvedValue(booking({ status: BookingStatus.CANCELLED }));

    const result = await service.execute({ token: TOKEN });

    expect(result.status).toBe(BookingStatus.CANCELLED);
    expect(bookingRepository.markCancelled).toHaveBeenCalledWith(
      1,
      expect.any(Date),
      'Cancelled by customer',
    );
  });

  it('throws NotFound for an unknown token', async () => {
    bookingRepository.findByCancellationToken.mockResolvedValue(null);

    await expect(service.execute({ token: 'wrong' })).rejects.toBeInstanceOf(NotFoundError);
  });

  it('refuses once the stay has already started', async () => {
    bookingRepository.findByCancellationToken.mockResolvedValue(
      booking({ checkIn: new Date('2020-01-01'), checkOut: new Date('2020-01-04') }),
    );

    await expect(service.execute({ token: TOKEN })).rejects.toBeInstanceOf(ConflictError);
    expect(bookingRepository.markCancelled).not.toHaveBeenCalled();
  });

  it('throws Conflict on the second click of a double-submitted button', async () => {
    bookingRepository.findByCancellationToken.mockResolvedValue(
      booking({ status: BookingStatus.CANCELLED }),
    );

    await expect(service.execute({ token: TOKEN })).rejects.toBeInstanceOf(ConflictError);
  });
});
