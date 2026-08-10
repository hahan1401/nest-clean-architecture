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
   * Every active room the guest count fits, whatever its state for `range`:
   * free, held by someone mid-checkout, or sold. Sold ones carry the checkout of
   * the last stay in the way, so a caller can say when to come back.
   */
  abstract findAvailable(range: DateRange, filter: RoomListFilter): Promise<RoomOffer[]>;

  /** Whether this room is free, held, or sold for `range`. */
  abstract checkAvailability(
    roomId: number,
    range: DateRange,
  ): Promise<{
    state: RoomAvailabilityState;
    heldUntil: Date | null;
    availableFrom: Date | null;
  }>;
}
