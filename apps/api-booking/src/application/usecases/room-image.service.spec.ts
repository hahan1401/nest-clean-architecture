import { NotFoundError, ValidationError } from '@app/common';
import { Room, RoomImage } from '@app/database';
import { RoomImageRepository } from '../../domain/repositories/room-image.repository';
import { RoomRepository } from '../../domain/repositories/room.repository';
import {
  AddRoomImageService,
  RemoveRoomImageService,
  ReorderRoomImagesService,
} from './room-image.service';

const room = (overrides: Partial<Room> = {}): Room =>
  new Room({
    id: 1,
    code: 'SUONG',
    name: 'Sương',
    description: null,
    maxGuests: 2,
    basePrice: 1_150_000,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

const image = (overrides: Partial<RoomImage> = {}): RoomImage =>
  new RoomImage({
    id: 1,
    roomId: 1,
    url: 'https://images.example.com/suong-1.jpg',
    position: 0,
    caption: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

describe('AddRoomImageService', () => {
  let roomRepository: jest.Mocked<RoomRepository>;
  let roomImageRepository: jest.Mocked<RoomImageRepository>;
  let service: AddRoomImageService;

  beforeEach(() => {
    roomRepository = { findById: jest.fn() } as unknown as jest.Mocked<RoomRepository>;
    roomImageRepository = { add: jest.fn() } as unknown as jest.Mocked<RoomImageRepository>;
    service = new AddRoomImageService(roomRepository, roomImageRepository);
  });

  it('adds the image once the room is confirmed to exist', async () => {
    roomRepository.findById.mockResolvedValue(room());
    roomImageRepository.add.mockResolvedValue(image());

    const result = await service.execute({
      roomId: 1,
      url: 'https://images.example.com/suong-1.jpg',
      caption: null,
    });

    expect(result.id).toBe(1);
    expect(roomImageRepository.add).toHaveBeenCalledWith({
      roomId: 1,
      url: 'https://images.example.com/suong-1.jpg',
      caption: null,
    });
  });

  it('throws NotFound rather than attaching an image to a nonexistent room', async () => {
    roomRepository.findById.mockResolvedValue(null);

    await expect(
      service.execute({ roomId: 99, url: 'https://images.example.com/x.jpg', caption: null }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(roomImageRepository.add).not.toHaveBeenCalled();
  });
});

describe('RemoveRoomImageService', () => {
  let roomImageRepository: jest.Mocked<RoomImageRepository>;
  let service: RemoveRoomImageService;

  beforeEach(() => {
    roomImageRepository = {
      findById: jest.fn(),
      remove: jest.fn(),
    } as unknown as jest.Mocked<RoomImageRepository>;
    service = new RemoveRoomImageService(roomImageRepository);
  });

  it('removes an image that belongs to the room', async () => {
    roomImageRepository.findById.mockResolvedValue(image());

    await service.execute({ roomId: 1, imageId: 1 });

    expect(roomImageRepository.remove).toHaveBeenCalledWith(1, 1);
  });

  it('throws NotFound for an image that is absent or belongs to another room', async () => {
    roomImageRepository.findById.mockResolvedValue(null);

    await expect(service.execute({ roomId: 1, imageId: 404 })).rejects.toBeInstanceOf(
      NotFoundError,
    );
    expect(roomImageRepository.remove).not.toHaveBeenCalled();
  });
});

describe('ReorderRoomImagesService', () => {
  let roomRepository: jest.Mocked<RoomRepository>;
  let roomImageRepository: jest.Mocked<RoomImageRepository>;
  let service: ReorderRoomImagesService;

  beforeEach(() => {
    roomRepository = {
      findById: jest.fn().mockResolvedValue(room()),
    } as unknown as jest.Mocked<RoomRepository>;
    roomImageRepository = {
      findByRoom: jest.fn(),
      reorder: jest.fn(),
    } as unknown as jest.Mocked<RoomImageRepository>;
    service = new ReorderRoomImagesService(roomRepository, roomImageRepository);
  });

  it('reorders when the request is exactly a permutation of the current images', async () => {
    roomImageRepository.findByRoom.mockResolvedValue([
      image({ id: 1, position: 0 }),
      image({ id: 2, position: 1 }),
    ]);
    roomImageRepository.reorder.mockResolvedValue([
      image({ id: 2, position: 0 }),
      image({ id: 1, position: 1 }),
    ]);

    const result = await service.execute({ roomId: 1, orderedImageIds: [2, 1] });

    expect(roomImageRepository.reorder).toHaveBeenCalledWith(1, [2, 1]);
    expect(result.map((img) => img.id)).toEqual([2, 1]);
  });

  it('rejects a list missing one of the room current images', async () => {
    roomImageRepository.findByRoom.mockResolvedValue([
      image({ id: 1, position: 0 }),
      image({ id: 2, position: 1 }),
    ]);

    await expect(service.execute({ roomId: 1, orderedImageIds: [1] })).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect(roomImageRepository.reorder).not.toHaveBeenCalled();
  });

  it('rejects a list carrying an id from another room', async () => {
    roomImageRepository.findByRoom.mockResolvedValue([image({ id: 1, position: 0 })]);

    await expect(service.execute({ roomId: 1, orderedImageIds: [1, 999] })).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it('throws NotFound for an unknown room', async () => {
    roomRepository.findById.mockResolvedValue(null);

    await expect(service.execute({ roomId: 99, orderedImageIds: [] })).rejects.toBeInstanceOf(
      NotFoundError,
    );
    expect(roomImageRepository.findByRoom).not.toHaveBeenCalled();
  });
});
