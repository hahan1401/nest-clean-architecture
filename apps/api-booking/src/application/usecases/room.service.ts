import { ConflictError, NotFoundError, ValidationError } from '@app/common';
import { Booking, PriceQuote, Room } from '@app/database';
import { Injectable } from '@nestjs/common';
import { RoomAvailability } from '../../domain/models/availability';
import { DateRange } from '../../domain/models/date-range';
import { PricingPort } from '../../domain/ports/pricing.port';
import { BookingRepository } from '../../domain/repositories/booking.repository';
import {
  CreateRoomData,
  RoomListFilter,
  RoomRepository,
} from '../../domain/repositories/room.repository';
import {
  CheckRoomAvailabilityInput,
  CheckRoomAvailabilityUseCase,
  CreateRoomUseCase,
  GetRoomByCodeUseCase,
  GetRoomUseCase,
  ListRoomBookingsInput,
  ListRoomBookingsUseCase,
  ListRoomsUseCase,
  SearchAvailableRoomsInput,
  SearchAvailableRoomsUseCase,
} from '../../domain/usecases/room.usecase';

/** Shared guard: a stay must cover at least one night. */
export const assertUsableRange = (range: DateRange): void => {
  if (!(range.to.getTime() > range.from.getTime())) {
    throw new ValidationError('checkOut must be after checkIn');
  }
};

@Injectable()
export class CreateRoomService implements CreateRoomUseCase {
  constructor(private readonly roomRepository: RoomRepository) {}

  async execute(data: CreateRoomData): Promise<Room> {
    const existing = await this.roomRepository.findByCode(data.code);
    if (existing) {
      throw new ConflictError(`Room with code ${data.code} already exists`);
    }
    return this.roomRepository.create(data);
  }
}

@Injectable()
export class ListRoomsService implements ListRoomsUseCase {
  constructor(private readonly roomRepository: RoomRepository) {}

  execute(filter: RoomListFilter): Promise<Room[]> {
    return this.roomRepository.findMany(filter);
  }
}

@Injectable()
export class GetRoomService implements GetRoomUseCase {
  constructor(private readonly roomRepository: RoomRepository) {}

  async execute(id: string): Promise<Room> {
    const room = await this.roomRepository.findById(id);
    if (!room) {
      throw new NotFoundError(`Room with id ${id} not found`);
    }
    return room;
  }
}

/**
 * Backs the public `/stays/<code>` URLs. `Room.code` is unique, so this is a
 * single indexed lookup - no different in cost from the id path.
 */
@Injectable()
export class GetRoomByCodeService implements GetRoomByCodeUseCase {
  constructor(private readonly roomRepository: RoomRepository) {}

  async execute(code: string): Promise<Room> {
    const room = await this.roomRepository.findByCode(code);
    if (!room) {
      throw new NotFoundError(`Room with code ${code} not found`);
    }
    return room;
  }
}

@Injectable()
export class SearchAvailableRoomsService implements SearchAvailableRoomsUseCase {
  constructor(
    private readonly roomRepository: RoomRepository,
    private readonly pricing: PricingPort,
  ) {}

  async execute(
    input: SearchAvailableRoomsInput,
  ): Promise<Array<{ room: Room; quote: PriceQuote }>> {
    assertUsableRange(input.range);

    const rooms = await this.roomRepository.findAvailable(input.range, {
      guests: input.guests,
      isActive: true,
      skip: input.skip,
      take: input.take,
    });

    return Promise.all(
      rooms.map(async (room) => ({
        room,
        quote: await this.pricing.quoteRoomStay(room, input.range),
      })),
    );
  }
}

@Injectable()
export class CheckRoomAvailabilityService implements CheckRoomAvailabilityUseCase {
  constructor(
    private readonly roomRepository: RoomRepository,
    private readonly pricing: PricingPort,
  ) {}

  async execute(input: CheckRoomAvailabilityInput): Promise<RoomAvailability> {
    assertUsableRange(input.range);

    const room = await this.roomRepository.findById(input.roomId);
    if (!room) {
      throw new NotFoundError(`Room with id ${input.roomId} not found`);
    }

    const available =
      room.isActive && (await this.roomRepository.isAvailable(room.id, input.range));

    // No point pricing a room nobody can take.
    return {
      room,
      available,
      quote: available ? await this.pricing.quoteRoomStay(room, input.range) : null,
    };
  }
}

@Injectable()
export class ListRoomBookingsService implements ListRoomBookingsUseCase {
  constructor(
    private readonly roomRepository: RoomRepository,
    private readonly bookingRepository: BookingRepository,
  ) {}

  async execute(input: ListRoomBookingsInput): Promise<Booking[]> {
    const room = await this.roomRepository.findById(input.roomId);
    if (!room) {
      throw new NotFoundError(`Room with id ${input.roomId} not found`);
    }
    return this.bookingRepository.findByRoom(room.id, input.filter);
  }
}
