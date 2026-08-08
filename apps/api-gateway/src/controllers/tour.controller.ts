import {
  AvailableDepartureResponseDto,
  BOOKING_PATTERNS,
  BOOKING_SERVICE,
  BookingHistoryQueryDto,
  BookingResponseDto,
  CreateTourDepartureDto,
  CreateTourDto,
  DepartureListQueryDto,
  TourAvailabilityQueryDto,
  TourDepartureResponseDto,
  TourListQueryDto,
  TourResponseDto,
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

@Controller('tours')
export class TourController {
  constructor(@Inject(BOOKING_SERVICE) private readonly bookingClient: ClientProxy) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Req() req: CorrelatedRequest, @Body() dto: CreateTourDto) {
    return lastValueFrom(
      this.bookingClient.send<TourResponseDto>(BOOKING_PATTERNS.CREATE_TOUR, {
        ...dto,
        requestId: req.requestId,
      }),
    );
  }

  @Get()
  list(@Req() req: CorrelatedRequest, @Query() query: TourListQueryDto) {
    return lastValueFrom(
      this.bookingClient.send<TourResponseDto[]>(BOOKING_PATTERNS.LIST_TOURS, {
        ...query,
        requestId: req.requestId,
      }),
    );
  }

  /** Declared before @Get(':id') - see the note in room.controller.ts. */
  @Get('availability')
  searchAvailable(@Req() req: CorrelatedRequest, @Query() query: TourAvailabilityQueryDto) {
    return lastValueFrom(
      this.bookingClient.send<AvailableDepartureResponseDto[]>(
        BOOKING_PATTERNS.SEARCH_AVAILABLE_DEPARTURES,
        { ...query, requestId: req.requestId },
      ),
    );
  }

  @Get(':id')
  get(@Req() req: CorrelatedRequest, @Param('id') id: string) {
    return lastValueFrom(
      this.bookingClient.send<TourResponseDto>(BOOKING_PATTERNS.GET_TOUR, {
        id,
        requestId: req.requestId,
      }),
    );
  }

  @Post(':id/departures')
  @HttpCode(HttpStatus.CREATED)
  createDeparture(
    @Req() req: CorrelatedRequest,
    @Param('id') id: string,
    @Body() dto: CreateTourDepartureDto,
  ) {
    return lastValueFrom(
      this.bookingClient.send<TourDepartureResponseDto>(BOOKING_PATTERNS.CREATE_TOUR_DEPARTURE, {
        tourId: id,
        ...dto,
        requestId: req.requestId,
      }),
    );
  }

  @Get(':id/departures')
  listDepartures(
    @Req() req: CorrelatedRequest,
    @Param('id') id: string,
    @Query() query: DepartureListQueryDto,
  ) {
    return lastValueFrom(
      this.bookingClient.send<TourDepartureResponseDto[]>(BOOKING_PATTERNS.LIST_TOUR_DEPARTURES, {
        tourId: id,
        ...query,
        requestId: req.requestId,
      }),
    );
  }

  @Get(':id/availability')
  checkAvailability(
    @Req() req: CorrelatedRequest,
    @Param('id') id: string,
    @Query() query: TourAvailabilityQueryDto,
  ) {
    return lastValueFrom(
      this.bookingClient.send<AvailableDepartureResponseDto[]>(
        BOOKING_PATTERNS.CHECK_TOUR_AVAILABILITY,
        { tourId: id, ...query, requestId: req.requestId },
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
      this.bookingClient.send<BookingResponseDto[]>(BOOKING_PATTERNS.LIST_TOUR_BOOKINGS, {
        tourId: id,
        ...query,
        requestId: req.requestId,
      }),
    );
  }
}
