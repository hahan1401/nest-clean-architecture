import type { RoomImage } from '@app/database';

export interface AddRoomImageData {
  roomId: number;
  url: string;
  caption: string | null;
  /** Appended after the current highest position when omitted. */
  position?: number;
}

export abstract class RoomImageRepository {
  abstract add(data: AddRoomImageData): Promise<RoomImage>;
  abstract findById(roomId: number, imageId: number): Promise<RoomImage | null>;
  /** Ordered ascending by position. */
  abstract findByRoom(roomId: number): Promise<RoomImage[]>;
  abstract remove(roomId: number, imageId: number): Promise<void>;
  /** Rewrites position to match `orderedImageIds`, 0-based, then returns the new order. */
  abstract reorder(roomId: number, orderedImageIds: number[]): Promise<RoomImage[]>;
}
