import type { Room } from '@app/database';
import type { RoomAvailabilityState, RoomOffer } from '../models/availability';
import type { DateRange } from '../models/date-range';
import type { ListRange } from '../models/pagination';

export interface CreateRoomData {
  code: string;
  name: string;
  description: string | null;
  maxGuests: number;
  basePrice: number;
}

export interface RoomListFilter extends ListRange {
  guests?: number;
  isActive?: boolean;
}

export abstract class RoomRepository {
  abstract create(data: CreateRoomData): Promise<Room>;
  abstract findById(id: number): Promise<Room | null>;
  abstract findByCode(code: string): Promise<Room | null>;
  abstract findMany(filter: RoomListFilter): Promise<Room[]>;

  /**
   * Rooms that are not sold for `range`: free ones, plus ones a pending booking
   * is holding, flagged with when that hold lapses. Rooms with a CONFIRMED or
   * COMPLETED overlap are excluded outright - those are not coming back.
   */
  abstract findAvailable(range: DateRange, filter: RoomListFilter): Promise<RoomOffer[]>;

  /** Whether this room is free, held, or sold for `range`. */
  abstract checkAvailability(
    roomId: number,
    range: DateRange,
  ): Promise<{ state: RoomAvailabilityState; heldUntil: Date | null }>;
}
