import { NotFoundError, ValidationError } from '@app/common';
import { RoomImage } from '@app/database';
import { Injectable } from '@nestjs/common';
import {
  AddRoomImageData,
  RoomImageRepository,
} from '../../domain/repositories/room-image.repository';
import { RoomRepository } from '../../domain/repositories/room.repository';
import {
  AddRoomImageUseCase,
  RemoveRoomImageInput,
  RemoveRoomImageUseCase,
  ReorderRoomImagesInput,
  ReorderRoomImagesUseCase,
} from '../../domain/usecases/room-image.usecase';

@Injectable()
export class AddRoomImageService implements AddRoomImageUseCase {
  constructor(
    private readonly roomRepository: RoomRepository,
    private readonly roomImageRepository: RoomImageRepository,
  ) {}

  async execute(data: AddRoomImageData): Promise<RoomImage> {
    const room = await this.roomRepository.findById(data.roomId);
    if (!room) {
      throw new NotFoundError(`Room with id ${data.roomId} not found`);
    }
    return this.roomImageRepository.add(data);
  }
}

@Injectable()
export class RemoveRoomImageService implements RemoveRoomImageUseCase {
  constructor(private readonly roomImageRepository: RoomImageRepository) {}

  async execute(input: RemoveRoomImageInput): Promise<void> {
    const image = await this.roomImageRepository.findById(input.roomId, input.imageId);
    if (!image) {
      throw new NotFoundError(`Image ${input.imageId} not found on room ${input.roomId}`);
    }
    await this.roomImageRepository.remove(input.roomId, input.imageId);
  }
}

@Injectable()
export class ReorderRoomImagesService implements ReorderRoomImagesUseCase {
  constructor(
    private readonly roomRepository: RoomRepository,
    private readonly roomImageRepository: RoomImageRepository,
  ) {}

  async execute(input: ReorderRoomImagesInput): Promise<RoomImage[]> {
    const room = await this.roomRepository.findById(input.roomId);
    if (!room) {
      throw new NotFoundError(`Room with id ${input.roomId} not found`);
    }

    const images = await this.roomImageRepository.findByRoom(input.roomId);
    const currentIds = new Set(images.map((image) => image.id));
    const requestedIds = input.orderedImageIds;
    const requestedIdSet = new Set(requestedIds);

    // The request must be a permutation of the room's actual image ids - not a
    // subset (that would silently orphan positions) and not a superset (that
    // would silently accept an id belonging to a different room).
    const isPermutation =
      requestedIdSet.size === requestedIds.length &&
      requestedIdSet.size === currentIds.size &&
      [...requestedIdSet].every((id) => currentIds.has(id));
    if (!isPermutation) {
      throw new ValidationError(
        "orderedImageIds must list exactly the room's current image ids, each exactly once",
      );
    }

    return this.roomImageRepository.reorder(input.roomId, requestedIds);
  }
}
