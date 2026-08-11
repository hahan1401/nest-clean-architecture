import type { RoomImage } from '@app/database';
import type { AddRoomImageData } from '../repositories/room-image.repository';

export interface AddRoomImageUseCase {
  execute(data: AddRoomImageData): Promise<RoomImage>;
}

export interface RemoveRoomImageInput {
  roomId: number;
  imageId: number;
}

export interface RemoveRoomImageUseCase {
  execute(input: RemoveRoomImageInput): Promise<void>;
}

export interface ReorderRoomImagesInput {
  roomId: number;
  /** Every current image id for this room, each exactly once, in the new order. */
  orderedImageIds: number[];
}

export interface ReorderRoomImagesUseCase {
  execute(input: ReorderRoomImagesInput): Promise<RoomImage[]>;
}
