import { ConflictError, NotFoundError, ValidationError } from '@app/common';
import { Booking, Room } from '@app/database';
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

  async execute(id: number): Promise<Room> {
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

  async execute(input: SearchAvailableRoomsInput): Promise<RoomAvailability[]> {
    assertUsableRange(input.range);

    const offers = await this.roomRepository.findAvailable(input.range, {
      guests: input.guests,
      isActive: true,
      skip: input.skip,
      take: input.take,
    });

    // Held rooms are priced too: someone deciding whether to wait out a hold
    // needs to know what they would be waiting for.
    return Promise.all(
      offers.map(async (offer) => ({
        room: offer.room,
        available: !offer.held,
        state: offer.held ? ('ON_HOLD' as const) : ('AVAILABLE' as const),
        heldUntil: offer.heldUntil,
        quote: await this.pricing.quoteRoomStay(offer.room, input.range),
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

    // A retired room is never coming back for this window, so it reads as BOOKED
    // rather than held - there is nothing to wait for.
    const { state, heldUntil } = room.isActive
      ? await this.roomRepository.checkAvailability(room.id, input.range)
      : { state: 'BOOKED' as const, heldUntil: null };

    // No point pricing a room nobody can ever take; a held one is still worth
    // pricing, because the guest may come back for it.
    const quote = state === 'BOOKED' ? null : await this.pricing.quoteRoomStay(room, input.range);

    return { room, available: state === 'AVAILABLE', state, heldUntil, quote };
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
