import { ConflictError, NotFoundError, ValidationError } from '@app/common';
import {
  Booking,
  DepartureStatus,
  PriceQuote,
  PriceQuoteLine,
  PriceSource,
  Room,
  Tour,
  TourDeparture,
} from '@app/database';
import { ConfigService } from '@nestjs/config';
import { PricingPort } from '../../domain/ports/pricing.port';
import { BookingRepository } from '../../domain/repositories/booking.repository';
import { RoomRepository } from '../../domain/repositories/room.repository';
import { TourDepartureRepository } from '../../domain/repositories/tour-departure.repository';
import { TourRepository } from '../../domain/repositories/tour.repository';
import { CreateBookingInput } from '../../domain/usecases/booking.usecase';
import { CreateBookingService } from './create-booking.service';

const FAR_FUTURE = { from: new Date('2099-02-13'), to: new Date('2099-02-16') };

const customer = { name: 'Tran Thi B', email: 'guest@example.com', phone: '0900000000' };

const quote = (total: number): PriceQuote =>
  new PriceQuote({
    currency: 'VND',
    total,
    lines: [
      new PriceQuoteLine({
        date: FAR_FUTURE.from,
        quantity: 1,
        unitAmount: total,
        amount: total,
        source: PriceSource.BASE,
        priceRuleId: null,
      }),
    ],
  });

const room = (overrides: Partial<Room> = {}): Room =>
  new Room({
    id: 1,
    code: 'GARDEN',
    name: 'Garden Room',
    maxGuests: 2,
    basePrice: 650_000,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

const tour = (): Tour =>
  new Tour({
    id: 1,
    slug: 'trek',
    name: 'Trek',
    durationDays: 1,
    basePricePerPerson: 450_000,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

const departure = (overrides: Partial<TourDeparture> = {}): TourDeparture =>
  new TourDeparture({
    id: 1,
    tourId: 1,
    departureDate: new Date('2099-03-06'),
    capacity: 12,
    bookedSeats: 0,
    priceOverride: null,
    status: DepartureStatus.OPEN,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

const roomInput = (overrides: Partial<Record<string, unknown>> = {}): CreateBookingInput => ({
  type: 'ROOM',
  roomId: 1,
  range: FAR_FUTURE,
  guests: 2,
  customer,
  ...overrides,
});

const tourInput = (overrides: Partial<Record<string, unknown>> = {}): CreateBookingInput => ({
  type: 'TOUR',
  tourDepartureId: 1,
  seats: 2,
  guests: 2,
  customer,
  ...overrides,
});

describe('CreateBookingService', () => {
  let bookingRepository: jest.Mocked<BookingRepository>;
  let roomRepository: jest.Mocked<RoomRepository>;
  let tourRepository: jest.Mocked<TourRepository>;
  let departureRepository: jest.Mocked<TourDepartureRepository>;
  let pricing: jest.Mocked<PricingPort>;
  let service: CreateBookingService;

  beforeEach(() => {
    bookingRepository = {
      createRoomBooking: jest.fn(),
      createTourBooking: jest.fn(),
    } as unknown as jest.Mocked<BookingRepository>;
    roomRepository = { findById: jest.fn() } as unknown as jest.Mocked<RoomRepository>;
    tourRepository = { findById: jest.fn() } as unknown as jest.Mocked<TourRepository>;
    departureRepository = {
      findById: jest.fn(),
    } as unknown as jest.Mocked<TourDepartureRepository>;
    pricing = { quoteRoomStay: jest.fn(), quoteTourSeats: jest.fn() };

    const configService = {
      get: jest.fn().mockReturnValue(30),
    } as unknown as jest.Mocked<ConfigService>;

    service = new CreateBookingService(
      bookingRepository,
      roomRepository,
      tourRepository,
      departureRepository,
      pricing,
      configService,
    );
  });

  describe('room bookings', () => {
    it('rejects a range that covers no nights', async () => {
      await expect(
        service.execute(
          roomInput({ range: { from: new Date('2099-02-13'), to: new Date('2099-02-13') } }),
        ),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('rejects a check-in in the past', async () => {
      await expect(
        service.execute(
          roomInput({ range: { from: new Date('2020-01-01'), to: new Date('2020-01-03') } }),
        ),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('throws NotFound for an unknown room', async () => {
      roomRepository.findById.mockResolvedValue(null);

      await expect(service.execute(roomInput())).rejects.toBeInstanceOf(NotFoundError);
    });

    it('rejects more guests than the room sleeps', async () => {
      roomRepository.findById.mockResolvedValue(room({ maxGuests: 2 }));

      await expect(service.execute(roomInput({ guests: 4 }))).rejects.toBeInstanceOf(
        ValidationError,
      );
    });

    it('throws Conflict when the room is inactive', async () => {
      roomRepository.findById.mockResolvedValue(room({ isActive: false }));

      await expect(service.execute(roomInput())).rejects.toBeInstanceOf(ConflictError);
    });

    it('throws Conflict when it loses the race to the exclusion constraint', async () => {
      roomRepository.findById.mockResolvedValue(room());
      pricing.quoteRoomStay.mockResolvedValue(quote(1_950_000));
      // null means the insert hit bookings_room_no_overlap.
      bookingRepository.createRoomBooking.mockResolvedValue(null);

      await expect(service.execute(roomInput())).rejects.toBeInstanceOf(ConflictError);
    });

    it('freezes the quoted total onto the booking', async () => {
      roomRepository.findById.mockResolvedValue(room());
      pricing.quoteRoomStay.mockResolvedValue(quote(1_950_000));
      bookingRepository.createRoomBooking.mockResolvedValue(new Booking({ id: 1 }));

      await service.execute(roomInput());

      const [data] = bookingRepository.createRoomBooking.mock.calls[0];
      expect(data.roomId).toBe(1);
      // Frozen, not recomputed: the persisted total is the quoted one.
      expect(data.quote.total).toBe(1_950_000);
      expect(data.reference).toMatch(/^BK-[2-9A-HJ-NP-Z]{8}$/);
      // 32 random bytes of hex - the cancel link's whole security.
      expect(data.cancellationToken).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe('tour bookings', () => {
    it('throws NotFound for an unknown departure', async () => {
      departureRepository.findById.mockResolvedValue(null);

      await expect(service.execute(tourInput())).rejects.toBeInstanceOf(NotFoundError);
    });

    it('throws Conflict for a departure that is not open', async () => {
      departureRepository.findById.mockResolvedValue(departure({ status: DepartureStatus.CLOSED }));

      await expect(service.execute(tourInput())).rejects.toBeInstanceOf(ConflictError);
    });

    it('throws Conflict for a departure that has already left', async () => {
      departureRepository.findById.mockResolvedValue(
        departure({ departureDate: new Date('2020-01-01') }),
      );

      await expect(service.execute(tourInput())).rejects.toBeInstanceOf(ConflictError);
    });

    it('rejects a guest count that disagrees with the seat count', async () => {
      await expect(service.execute(tourInput({ guests: 3, seats: 2 }))).rejects.toBeInstanceOf(
        ValidationError,
      );
    });

    it('throws Conflict when the seats are gone', async () => {
      departureRepository.findById.mockResolvedValue(departure());
      tourRepository.findById.mockResolvedValue(tour());
      pricing.quoteTourSeats.mockResolvedValue(quote(900_000));
      // null means the conditional seat UPDATE matched no rows.
      bookingRepository.createTourBooking.mockResolvedValue(null);

      await expect(service.execute(tourInput())).rejects.toBeInstanceOf(ConflictError);
    });

    it('freezes the quoted total and the seat count', async () => {
      departureRepository.findById.mockResolvedValue(departure());
      tourRepository.findById.mockResolvedValue(tour());
      pricing.quoteTourSeats.mockResolvedValue(quote(900_000));
      bookingRepository.createTourBooking.mockResolvedValue(new Booking({ id: 2 }));

      await service.execute(tourInput());

      const [data] = bookingRepository.createTourBooking.mock.calls[0];
      expect(data.tourDepartureId).toBe(1);
      expect(data.seats).toBe(2);
      expect(data.quote.total).toBe(900_000);
    });
  });
});

describe('hold TTL', () => {
  const buildWith = (ttlMinutes: number | undefined) => {
    const bookingRepository = {
      createRoomBooking: jest.fn().mockResolvedValue(new Booking({ id: 1 })),
    } as unknown as jest.Mocked<BookingRepository>;
    const roomRepository = {
      findById: jest.fn().mockResolvedValue(room()),
    } as unknown as jest.Mocked<RoomRepository>;
    const pricing = {
      quoteRoomStay: jest.fn().mockResolvedValue(quote(900_000)),
      quoteTourSeats: jest.fn(),
    };
    const configService = {
      get: jest.fn((key: string) => (key === 'BOOKING_HOLD_TTL_MINUTES' ? ttlMinutes : undefined)),
    } as unknown as jest.Mocked<ConfigService>;

    return {
      bookingRepository,
      service: new CreateBookingService(
        bookingRepository,
        roomRepository,
        {} as jest.Mocked<TourRepository>,
        {} as jest.Mocked<TourDepartureRepository>,
        pricing,
        configService,
      ),
    };
  };

  const heldMinutes = (bookingRepository: jest.Mocked<BookingRepository>): number => {
    const [data] = bookingRepository.createRoomBooking.mock.calls[0];
    return Math.round((data.holdExpiresAt.getTime() - Date.now()) / 60_000);
  };

  it('holds the slot for 3 minutes by default', async () => {
    const { service, bookingRepository } = buildWith(undefined);

    await service.execute(roomInput());

    expect(heldMinutes(bookingRepository)).toBe(3);
  });

  it('honours BOOKING_HOLD_TTL_MINUTES when set', async () => {
    const { service, bookingRepository } = buildWith(15);

    await service.execute(roomInput());

    expect(heldMinutes(bookingRepository)).toBe(15);
  });
});
