import { ConflictError, NotFoundError } from '@app/common';
import { Booking, BookingStatus } from '@app/database';
import { PinoLogger } from 'nestjs-pino';
import type { BookingDetail } from '../../domain/models/booking-detail';
import {
  BookingCancelledNotification,
  BookingNotifierPort,
} from '../../domain/ports/booking-notifier.port';
import { BookingRepository } from '../../domain/repositories/booking.repository';
import {
  CancelBookingByTokenService,
  CancelBookingService,
  GetBookingByCancellationTokenService,
} from './cancel-booking.service';

const TOKEN = 'a'.repeat(64);

const detailOf = (b: Booking): BookingDetail => ({
  booking: b,
  roomName: 'Garden Room',
  tourName: null,
  departureDate: null,
});

const makeNotifier = () =>
  ({
    notifyBookingConfirmed: jest.fn().mockResolvedValue(undefined),
    notifyBookingCancelled: jest.fn().mockResolvedValue(undefined),
  }) as unknown as jest.Mocked<BookingNotifierPort>;

const cancelledArg = (notifier: jest.Mocked<BookingNotifierPort>): BookingCancelledNotification =>
  notifier.notifyBookingCancelled.mock.calls[0][0];

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
  let notifier: jest.Mocked<BookingNotifierPort>;
  let logger: jest.Mocked<PinoLogger>;
  let service: CancelBookingService;

  beforeEach(() => {
    bookingRepository = {
      findDetailedById: jest.fn(),
      markCancelled: jest.fn(),
    } as unknown as jest.Mocked<BookingRepository>;
    notifier = makeNotifier();
    logger = {
      setContext: jest.fn(),
      info: jest.fn(),
      error: jest.fn(),
    } as unknown as jest.Mocked<PinoLogger>;
    service = new CancelBookingService(bookingRepository, notifier, logger);
  });

  it('throws NotFound for an unknown booking', async () => {
    bookingRepository.findDetailedById.mockResolvedValue(null);

    await expect(service.execute({ bookingId: 999 })).rejects.toBeInstanceOf(NotFoundError);
  });

  it('cancels a confirmed booking', async () => {
    bookingRepository.findDetailedById.mockResolvedValue(detailOf(booking()));
    bookingRepository.markCancelled.mockResolvedValue(booking({ status: BookingStatus.CANCELLED }));

    const result = await service.execute({ bookingId: 1, reason: 'plans changed' });

    expect(result.status).toBe(BookingStatus.CANCELLED);
    expect(bookingRepository.markCancelled).toHaveBeenCalledWith(
      1,
      expect.any(Date),
      'plans changed',
    );
  });

  it('announces the cancellation as owner-initiated, carrying the reason and labels', async () => {
    bookingRepository.findDetailedById.mockResolvedValue(detailOf(booking()));
    bookingRepository.markCancelled.mockResolvedValue(booking({ status: BookingStatus.CANCELLED }));

    await service.execute({ bookingId: 1, reason: 'plans changed', requestId: 'req-9' });

    expect(notifier.notifyBookingCancelled).toHaveBeenCalledTimes(1);
    expect(cancelledArg(notifier)).toEqual(
      expect.objectContaining({
        reference: 'BK-7F3K9Q2A',
        cancelledBy: 'owner',
        reason: 'plans changed',
        type: 'ROOM',
        roomName: 'Garden Room',
        requestId: 'req-9',
      }),
    );
  });

  it('does not announce a cancellation that never happened', async () => {
    bookingRepository.findDetailedById.mockResolvedValue(
      detailOf(booking({ status: BookingStatus.CANCELLED })),
    );

    await expect(service.execute({ bookingId: 1 })).rejects.toBeInstanceOf(ConflictError);
    expect(notifier.notifyBookingCancelled).not.toHaveBeenCalled();
  });

  it('still returns the cancelled booking when the announcement rejects', async () => {
    bookingRepository.findDetailedById.mockResolvedValue(detailOf(booking()));
    bookingRepository.markCancelled.mockResolvedValue(booking({ status: BookingStatus.CANCELLED }));
    notifier.notifyBookingCancelled.mockRejectedValue(new Error('port broke its contract'));

    // The row is already CANCELLED; failing the RPC would send the caller into a 409 retry.
    const result = await service.execute({ bookingId: 1 });

    expect(result.status).toBe(BookingStatus.CANCELLED);
    expect(logger.error).toHaveBeenCalled();
  });

  it('throws Conflict on a second cancel', async () => {
    bookingRepository.findDetailedById.mockResolvedValue(
      detailOf(booking({ status: BookingStatus.CANCELLED })),
    );

    await expect(service.execute({ bookingId: 1 })).rejects.toBeInstanceOf(ConflictError);
    expect(bookingRepository.markCancelled).not.toHaveBeenCalled();
  });

  it('throws Conflict for a completed booking', async () => {
    bookingRepository.findDetailedById.mockResolvedValue(
      detailOf(booking({ status: BookingStatus.COMPLETED })),
    );

    await expect(service.execute({ bookingId: 1 })).rejects.toBeInstanceOf(ConflictError);
  });

  it('throws Conflict when it loses the race to the conditional update', async () => {
    bookingRepository.findDetailedById.mockResolvedValue(detailOf(booking()));
    bookingRepository.markCancelled.mockResolvedValue(null);

    await expect(service.execute({ bookingId: 1 })).rejects.toBeInstanceOf(ConflictError);
    expect(notifier.notifyBookingCancelled).not.toHaveBeenCalled();
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
  let notifier: jest.Mocked<BookingNotifierPort>;
  let logger: jest.Mocked<PinoLogger>;
  let service: CancelBookingByTokenService;

  beforeEach(() => {
    bookingRepository = {
      findByCancellationToken: jest.fn(),
      findDetailedById: jest.fn().mockResolvedValue(detailOf(booking())),
      markCancelled: jest.fn(),
    } as unknown as jest.Mocked<BookingRepository>;
    notifier = makeNotifier();
    logger = {
      setContext: jest.fn(),
      info: jest.fn(),
      error: jest.fn(),
    } as unknown as jest.Mocked<PinoLogger>;
    service = new CancelBookingByTokenService(bookingRepository, notifier, logger);
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

  it('announces the cancellation as customer-initiated', async () => {
    bookingRepository.findByCancellationToken.mockResolvedValue(booking());
    bookingRepository.markCancelled.mockResolvedValue(booking({ status: BookingStatus.CANCELLED }));

    await service.execute({ token: TOKEN, requestId: 'req-4' });

    expect(cancelledArg(notifier)).toEqual(
      expect.objectContaining({
        cancelledBy: 'customer',
        roomName: 'Garden Room',
        requestId: 'req-4',
      }),
    );
  });

  it('stores the audit reason but does not echo it back as a stated reason', async () => {
    bookingRepository.findByCancellationToken.mockResolvedValue(booking());
    bookingRepository.markCancelled.mockResolvedValue(booking({ status: BookingStatus.CANCELLED }));

    await service.execute({ token: TOKEN });

    expect(bookingRepository.markCancelled).toHaveBeenCalledWith(
      1,
      expect.any(Date),
      'Cancelled by customer',
    );
    expect(cancelledArg(notifier).reason).toBeNull();
  });

  it('passes on a reason the guest actually typed', async () => {
    bookingRepository.findByCancellationToken.mockResolvedValue(booking());
    bookingRepository.markCancelled.mockResolvedValue(booking({ status: BookingStatus.CANCELLED }));

    await service.execute({ token: TOKEN, reason: '  family emergency  ' });

    expect(cancelledArg(notifier).reason).toBe('family emergency');
  });

  it('still announces when the label lookup fails, falling back to a generic name', async () => {
    bookingRepository.findByCancellationToken.mockResolvedValue(booking());
    bookingRepository.markCancelled.mockResolvedValue(booking({ status: BookingStatus.CANCELLED }));
    bookingRepository.findDetailedById.mockRejectedValue(new Error('replica down'));

    const result = await service.execute({ token: TOKEN });

    expect(result.status).toBe(BookingStatus.CANCELLED);
    expect(cancelledArg(notifier)).toEqual(expect.objectContaining({ roomName: 'Room' }));
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
