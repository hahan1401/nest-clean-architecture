import { NotFoundError, ValidationError } from '@app/common';
import { PriceQuote, Room } from '@app/database';
import { PricingPort } from '../../domain/ports/pricing.port';
import { RoomRepository } from '../../domain/repositories/room.repository';
import {
  CheckRoomAvailabilityService,
  GetRoomByCodeService,
  SearchAvailableRoomsService,
} from './room.service';

const room = (overrides: Partial<Room> = {}): Room =>
  new Room({
    id: 1,
    code: 'SUONG',
    name: 'Sương',
    description: 'The smallest room, and the one the fog reaches first.',
    maxGuests: 2,
    basePrice: 1_150_000,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

describe('GetRoomByCodeService', () => {
  let roomRepository: jest.Mocked<RoomRepository>;
  let service: GetRoomByCodeService;

  beforeEach(() => {
    roomRepository = {
      findByCode: jest.fn(),
    } as unknown as jest.Mocked<RoomRepository>;
    service = new GetRoomByCodeService(roomRepository);
  });

  it('returns the room behind a public /stays/<code> URL', async () => {
    roomRepository.findByCode.mockResolvedValue(room());

    const result = await service.execute('SUONG');

    expect(result.code).toBe('SUONG');
    expect(roomRepository.findByCode).toHaveBeenCalledWith('SUONG');
  });

  it('throws NotFound for an unknown code', async () => {
    roomRepository.findByCode.mockResolvedValue(null);

    await expect(service.execute('NOPE')).rejects.toBeInstanceOf(NotFoundError);
  });
});

const RANGE = { from: new Date('2099-02-13'), to: new Date('2099-02-16') };
const HELD_UNTIL = new Date('2099-02-01T10:03:00.000Z');

const quote = () => new PriceQuote({ currency: 'VND', total: 3_450_000, lines: [] });

describe('SearchAvailableRoomsService', () => {
  let roomRepository: jest.Mocked<RoomRepository>;
  let pricing: jest.Mocked<PricingPort>;
  let service: SearchAvailableRoomsService;

  beforeEach(() => {
    roomRepository = { findAvailable: jest.fn() } as unknown as jest.Mocked<RoomRepository>;
    pricing = {
      quoteRoomStay: jest.fn().mockResolvedValue(quote()),
      quoteTourSeats: jest.fn(),
    };
    service = new SearchAvailableRoomsService(roomRepository, pricing);
  });

  it('reports a free room as AVAILABLE', async () => {
    roomRepository.findAvailable.mockResolvedValue([
      { room: room(), held: false, heldUntil: null },
    ]);

    const [result] = await service.execute({ range: RANGE });

    expect(result.state).toBe('AVAILABLE');
    expect(result.heldUntil).toBeNull();
  });

  it('still returns a held room, flagged with when the hold lapses', async () => {
    roomRepository.findAvailable.mockResolvedValue([
      { room: room(), held: true, heldUntil: HELD_UNTIL },
    ]);

    const [result] = await service.execute({ range: RANGE });

    // The whole point: the guest sees the room exists and can come back for it.
    expect(result.state).toBe('ON_HOLD');
    expect(result.heldUntil).toEqual(HELD_UNTIL);
  });

  it('prices a held room too, so the guest knows what they are waiting for', async () => {
    roomRepository.findAvailable.mockResolvedValue([
      { room: room(), held: true, heldUntil: HELD_UNTIL },
    ]);

    const [result] = await service.execute({ range: RANGE });

    expect(result.quote?.total).toBe(3_450_000);
  });

  it('rejects a range covering no nights before touching the database', async () => {
    await expect(
      service.execute({ range: { from: RANGE.from, to: RANGE.from } }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(roomRepository.findAvailable).not.toHaveBeenCalled();
  });
});

describe('CheckRoomAvailabilityService', () => {
  let roomRepository: jest.Mocked<RoomRepository>;
  let pricing: jest.Mocked<PricingPort>;
  let service: CheckRoomAvailabilityService;

  beforeEach(() => {
    roomRepository = {
      findById: jest.fn().mockResolvedValue(room()),
      checkAvailability: jest.fn(),
    } as unknown as jest.Mocked<RoomRepository>;
    pricing = {
      quoteRoomStay: jest.fn().mockResolvedValue(quote()),
      quoteTourSeats: jest.fn(),
    };
    service = new CheckRoomAvailabilityService(roomRepository, pricing);
  });

  it('passes through AVAILABLE with a quote', async () => {
    roomRepository.checkAvailability.mockResolvedValue({ state: 'AVAILABLE', heldUntil: null });

    const result = await service.execute({ roomId: 1, range: RANGE });

    expect(result.state).toBe('AVAILABLE');
    expect(result.quote).not.toBeNull();
  });

  it('reports ON_HOLD with the expiry and still prices it', async () => {
    roomRepository.checkAvailability.mockResolvedValue({
      state: 'ON_HOLD',
      heldUntil: HELD_UNTIL,
    });

    const result = await service.execute({ roomId: 1, range: RANGE });

    expect(result.state).toBe('ON_HOLD');
    expect(result.heldUntil).toEqual(HELD_UNTIL);
    expect(result.quote).not.toBeNull();
  });

  it('does not price a sold room', async () => {
    roomRepository.checkAvailability.mockResolvedValue({ state: 'BOOKED', heldUntil: null });

    const result = await service.execute({ roomId: 1, range: RANGE });

    expect(result.state).toBe('BOOKED');
    expect(result.quote).toBeNull();
    expect(pricing.quoteRoomStay).not.toHaveBeenCalled();
  });

  it('treats a retired room as BOOKED - there is nothing to wait for', async () => {
    roomRepository.findById.mockResolvedValue(room({ isActive: false }));

    const result = await service.execute({ roomId: 1, range: RANGE });

    expect(result.state).toBe('BOOKED');
    expect(roomRepository.checkAvailability).not.toHaveBeenCalled();
  });

  it('throws NotFound for an unknown room', async () => {
    roomRepository.findById.mockResolvedValue(null);

    await expect(service.execute({ roomId: 99, range: RANGE })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});
