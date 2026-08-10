import type { Booking, PriceQuote, Room } from '@app/database';
import type { RoomAvailability } from '../models/availability';
import type { DateRange } from '../models/date-range';
import type { BookingHistoryFilter } from '../repositories/booking.repository';
import type { CreateRoomData, RoomListFilter } from '../repositories/room.repository';

export interface CreateRoomUseCase {
  execute(data: CreateRoomData): Promise<Room>;
}

export interface ListRoomsUseCase {
  execute(filter: RoomListFilter): Promise<Room[]>;
}

export interface GetRoomUseCase {
  execute(id: string): Promise<Room>;
}

/** Lookup by the human-readable `Room.code`, so public URLs need no uuid. */
export interface GetRoomByCodeUseCase {
  execute(code: string): Promise<Room>;
}

export interface SearchAvailableRoomsInput {
  range: DateRange;
  guests?: number;
  skip?: number;
  take?: number;
}

export interface SearchAvailableRoomsUseCase {
  execute(input: SearchAvailableRoomsInput): Promise<Array<{ room: Room; quote: PriceQuote }>>;
}

export interface CheckRoomAvailabilityInput {
  roomId: string;
  range: DateRange;
}

export interface CheckRoomAvailabilityUseCase {
  execute(input: CheckRoomAvailabilityInput): Promise<RoomAvailability>;
}

export interface ListRoomBookingsInput {
  roomId: string;
  filter: BookingHistoryFilter;
}

export interface ListRoomBookingsUseCase {
  execute(input: ListRoomBookingsInput): Promise<Booking[]>;
}
