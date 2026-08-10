import {
  BOOKING_PATTERNS,
  BOOKING_SERVICE,
  BookingHistoryQueryDto,
  BookingResponseDto,
  CreateRoomDto,
  RoomAvailabilityResponseDto,
  RoomAvailabilityQueryDto,
  RoomListQueryDto,
  RoomResponseDto,
} from '@app/common';
import type { CorrelatedRequest } from '@app/common';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';

@Controller('rooms')
export class RoomController {
  constructor(@Inject(BOOKING_SERVICE) private readonly bookingClient: ClientProxy) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Req() req: CorrelatedRequest, @Body() dto: CreateRoomDto) {
    return lastValueFrom(
      this.bookingClient.send<RoomResponseDto>(BOOKING_PATTERNS.CREATE_ROOM, {
        ...dto,
        requestId: req.requestId,
      }),
    );
  }

  @Get()
  list(@Req() req: CorrelatedRequest, @Query() query: RoomListQueryDto) {
    return lastValueFrom(
      this.bookingClient.send<RoomResponseDto[]>(BOOKING_PATTERNS.LIST_ROOMS, {
        ...query,
        requestId: req.requestId,
      }),
    );
  }

  /**
   * Declared before @Get(':id') on purpose - Express matches in declaration
   * order, so the other way round this URL would look up a room called
   * "availability".
   */
  @Get('availability')
  searchAvailable(@Req() req: CorrelatedRequest, @Query() query: RoomAvailabilityQueryDto) {
    return lastValueFrom(
      this.bookingClient.send<RoomAvailabilityResponseDto[]>(
        BOOKING_PATTERNS.SEARCH_AVAILABLE_ROOMS,
        { ...query, requestId: req.requestId },
      ),
    );
  }

  /**
   * Also declared before @Get(':id'): otherwise Express matches "code" as the
   * id and every /rooms/code/<code> request 404s on a room called "code".
   */
  @Get('code/:code')
  getByCode(@Req() req: CorrelatedRequest, @Param('code') code: string) {
    return lastValueFrom(
      this.bookingClient.send<RoomResponseDto>(BOOKING_PATTERNS.GET_ROOM_BY_CODE, {
        code,
        requestId: req.requestId,
      }),
    );
  }

  @Get(':id')
  get(@Req() req: CorrelatedRequest, @Param('id') id: string) {
    return lastValueFrom(
      this.bookingClient.send<RoomResponseDto>(BOOKING_PATTERNS.GET_ROOM, {
        id,
        requestId: req.requestId,
      }),
    );
  }

  @Get(':id/availability')
  checkAvailability(
    @Req() req: CorrelatedRequest,
    @Param('id') id: string,
    @Query() query: RoomAvailabilityQueryDto,
  ) {
    return lastValueFrom(
      this.bookingClient.send<RoomAvailabilityResponseDto>(
        BOOKING_PATTERNS.CHECK_ROOM_AVAILABILITY,
        { roomId: id, from: query.from, to: query.to, requestId: req.requestId },
      ),
    );
  }

  @Get(':id/bookings')
  listBookings(
    @Req() req: CorrelatedRequest,
    @Param('id') id: string,
    @Query() query: BookingHistoryQueryDto,
  ) {
    return lastValueFrom(
      this.bookingClient.send<BookingResponseDto[]>(BOOKING_PATTERNS.LIST_ROOM_BOOKINGS, {
        roomId: id,
        ...query,
        requestId: req.requestId,
      }),
    );
  }
}
