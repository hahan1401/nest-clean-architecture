import type { Room } from '@app/database';
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
  abstract findById(id: string): Promise<Room | null>;
  abstract findByCode(code: string): Promise<Room | null>;
  abstract findMany(filter: RoomListFilter): Promise<Room[]>;

  /** Rooms with no slot-holding booking overlapping `range`. */
  abstract findAvailable(range: DateRange, filter: RoomListFilter): Promise<Room[]>;

  /** True when no slot-holding booking overlaps `range` for this room. */
  abstract isAvailable(roomId: string, range: DateRange): Promise<boolean>;
}
