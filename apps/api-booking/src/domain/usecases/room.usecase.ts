import type { Booking, Room } from '@app/database';
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
  execute(id: number): Promise<Room>;
}

/** Lookup by the human-readable `Room.code`, so public URLs need no numeric id. */
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
  /** Free rooms and held ones; sold rooms are left out entirely. */
  execute(input: SearchAvailableRoomsInput): Promise<RoomAvailability[]>;
}

export interface CheckRoomAvailabilityInput {
  roomId: number;
  range: DateRange;
}

export interface CheckRoomAvailabilityUseCase {
  execute(input: CheckRoomAvailabilityInput): Promise<RoomAvailability>;
}

export interface ListRoomBookingsInput {
  roomId: number;
  filter: BookingHistoryFilter;
}

export interface ListRoomBookingsUseCase {
  execute(input: ListRoomBookingsInput): Promise<Booking[]>;
}
