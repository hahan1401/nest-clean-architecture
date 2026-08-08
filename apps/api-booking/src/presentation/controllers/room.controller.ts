import {
  BOOKING_PATTERNS,
  BookingResponseDto,
  CreateRoomDto,
  RoomAvailabilityResponseDto,
  RoomResponseDto,
} from '@app/common';
import { BookingStatus } from '@app/database';
import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  CheckRoomAvailabilityService,
  CreateRoomService,
  GetRoomService,
  ListRoomBookingsService,
  ListRoomsService,
  SearchAvailableRoomsService,
} from '../../application/usecases/room.service';
import { toDateRange, toOptionalRange } from '../utils/payload-dates';

@Controller()
export class RoomController {
  constructor(
    private readonly createRoomService: CreateRoomService,
    private readonly listRoomsService: ListRoomsService,
    private readonly getRoomService: GetRoomService,
    private readonly searchAvailableRoomsService: SearchAvailableRoomsService,
    private readonly checkRoomAvailabilityService: CheckRoomAvailabilityService,
    private readonly listRoomBookingsService: ListRoomBookingsService,
  ) {}

  @MessagePattern(BOOKING_PATTERNS.CREATE_ROOM)
  async create(@Payload() data: CreateRoomDto): Promise<RoomResponseDto> {
    const room = await this.createRoomService.execute({
      code: data.code,
      name: data.name,
      description: data.description ?? null,
      maxGuests: data.maxGuests,
      basePrice: data.basePrice,
    });
    return new RoomResponseDto(room);
  }

  @MessagePattern(BOOKING_PATTERNS.LIST_ROOMS)
  async list(
    @Payload() data: { guests?: number; skip?: number; take?: number },
  ): Promise<RoomResponseDto[]> {
    const rooms = await this.listRoomsService.execute({
      guests: data.guests,
      skip: data.skip,
      take: data.take,
    });
    return rooms.map((room) => new RoomResponseDto(room));
  }

  @MessagePattern(BOOKING_PATTERNS.GET_ROOM)
  async get(@Payload() data: { id: string }): Promise<RoomResponseDto> {
    const room = await this.getRoomService.execute(data.id);
    return new RoomResponseDto(room);
  }

  @MessagePattern(BOOKING_PATTERNS.SEARCH_AVAILABLE_ROOMS)
  async searchAvailable(
    @Payload() data: { from: string; to: string; guests?: number; skip?: number; take?: number },
  ): Promise<RoomAvailabilityResponseDto[]> {
    const results = await this.searchAvailableRoomsService.execute({
      range: toDateRange(data.from, data.to),
      guests: data.guests,
      skip: data.skip,
      take: data.take,
    });
    return results.map(
      (result) => new RoomAvailabilityResponseDto(result.room, true, result.quote),
    );
  }

  @MessagePattern(BOOKING_PATTERNS.CHECK_ROOM_AVAILABILITY)
  async checkAvailability(
    @Payload() data: { roomId: string; from: string; to: string },
  ): Promise<RoomAvailabilityResponseDto> {
    const result = await this.checkRoomAvailabilityService.execute({
      roomId: data.roomId,
      range: toDateRange(data.from, data.to),
    });
    return new RoomAvailabilityResponseDto(result.room, result.available, result.quote);
  }

  @MessagePattern(BOOKING_PATTERNS.LIST_ROOM_BOOKINGS)
  async listBookings(
    @Payload()
    data: {
      roomId: string;
      status?: BookingStatus;
      from?: string;
      to?: string;
      skip?: number;
      take?: number;
    },
  ): Promise<BookingResponseDto[]> {
    const bookings = await this.listRoomBookingsService.execute({
      roomId: data.roomId,
      filter: {
        status: data.status,
        range: toOptionalRange(data.from, data.to),
        skip: data.skip,
        take: data.take,
      },
    });
    return bookings.map((booking) => new BookingResponseDto(booking));
  }
}
