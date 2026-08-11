import {
  AddImageDto,
  AvailableDepartureResponseDto,
  BOOKING_PATTERNS,
  BOOKING_SERVICE,
  BookingHistoryQueryDto,
  BookingResponseDto,
  CreateTourDepartureDto,
  CreateTourDto,
  DepartureListQueryDto,
  ReorderImagesDto,
  TourAvailabilityQueryDto,
  TourDepartureResponseDto,
  TourImageResponseDto,
  TourListQueryDto,
  TourResponseDto,
} from '@app/common';
import type { CorrelatedRequest } from '@app/common';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseIntPipe,
  Patch,
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

  /** Declared before @Get(':id') for the same reason - see room.controller.ts. */
  @Get('slug/:slug')
  getBySlug(@Req() req: CorrelatedRequest, @Param('slug') slug: string) {
    return lastValueFrom(
      this.bookingClient.send<TourResponseDto>(BOOKING_PATTERNS.GET_TOUR_BY_SLUG, {
        slug,
        requestId: req.requestId,
      }),
    );
  }

  @Get(':id')
  get(@Req() req: CorrelatedRequest, @Param('id', ParseIntPipe) id: number) {
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
    @Param('id', ParseIntPipe) id: number,
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
    @Param('id', ParseIntPipe) id: number,
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
    @Param('id', ParseIntPipe) id: number,
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
    @Param('id', ParseIntPipe) id: number,
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

  @Post(':id/images')
  @HttpCode(HttpStatus.CREATED)
  addImage(
    @Req() req: CorrelatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddImageDto,
  ) {
    return lastValueFrom(
      this.bookingClient.send<TourImageResponseDto>(BOOKING_PATTERNS.ADD_TOUR_IMAGE, {
        tourId: id,
        ...dto,
        requestId: req.requestId,
      }),
    );
  }

  @Patch(':id/images/reorder')
  reorderImages(
    @Req() req: CorrelatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReorderImagesDto,
  ) {
    return lastValueFrom(
      this.bookingClient.send<TourImageResponseDto[]>(BOOKING_PATTERNS.REORDER_TOUR_IMAGES, {
        tourId: id,
        ...dto,
        requestId: req.requestId,
      }),
    );
  }

  @Delete(':id/images/:imageId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeImage(
    @Req() req: CorrelatedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Param('imageId', ParseIntPipe) imageId: number,
  ): Promise<void> {
    await lastValueFrom(
      this.bookingClient.send<{ deleted: boolean }>(BOOKING_PATTERNS.REMOVE_TOUR_IMAGE, {
        tourId: id,
        imageId,
        requestId: req.requestId,
      }),
    );
  }
}
