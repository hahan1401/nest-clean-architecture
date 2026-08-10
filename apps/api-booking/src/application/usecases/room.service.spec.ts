import { NotFoundError } from '@app/common';
import { Room } from '@app/database';
import { RoomRepository } from '../../domain/repositories/room.repository';
import { GetRoomByCodeService } from './room.service';

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
