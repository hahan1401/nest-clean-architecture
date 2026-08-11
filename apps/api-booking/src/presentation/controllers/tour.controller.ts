import {
  AddImageDto,
  AvailableDepartureResponseDto,
  BOOKING_PATTERNS,
  BookingResponseDto,
  CreateTourDepartureDto,
  CreateTourDto,
  ReorderImagesDto,
  TourDepartureResponseDto,
  TourImageResponseDto,
  TourResponseDto,
} from '@app/common';
import { BookingStatus } from '@app/database';
import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  AddTourImageService,
  RemoveTourImageService,
  ReorderTourImagesService,
} from '../../application/usecases/tour-image.service';
import {
  CheckTourAvailabilityService,
  CreateTourDepartureService,
  CreateTourService,
  GetTourBySlugService,
  GetTourService,
  ListTourBookingsService,
  ListTourDeparturesService,
  ListToursService,
  SearchAvailableDeparturesService,
} from '../../application/usecases/tour.service';
import { toDateRange, toOptionalRange, toInstant } from '../utils/payload-dates';

@Controller()
export class TourController {
  constructor(
    private readonly createTourService: CreateTourService,
    private readonly listToursService: ListToursService,
    private readonly getTourService: GetTourService,
    private readonly getTourBySlugService: GetTourBySlugService,
    private readonly createTourDepartureService: CreateTourDepartureService,
    private readonly listTourDeparturesService: ListTourDeparturesService,
    private readonly searchAvailableDeparturesService: SearchAvailableDeparturesService,
    private readonly checkTourAvailabilityService: CheckTourAvailabilityService,
    private readonly listTourBookingsService: ListTourBookingsService,
    private readonly addTourImageService: AddTourImageService,
    private readonly removeTourImageService: RemoveTourImageService,
    private readonly reorderTourImagesService: ReorderTourImagesService,
  ) {}

  @MessagePattern(BOOKING_PATTERNS.CREATE_TOUR)
  async create(@Payload() data: CreateTourDto): Promise<TourResponseDto> {
    const tour = await this.createTourService.execute({
      slug: data.slug,
      name: data.name,
      description: data.description ?? null,
      durationDays: data.durationDays,
      basePricePerPerson: data.basePricePerPerson,
    });
    return new TourResponseDto(tour);
  }

  @MessagePattern(BOOKING_PATTERNS.LIST_TOURS)
  async list(@Payload() data: { skip?: number; take?: number }): Promise<TourResponseDto[]> {
    const tours = await this.listToursService.execute({ skip: data.skip, take: data.take });
    return tours.map((tour) => new TourResponseDto(tour));
  }

  @MessagePattern(BOOKING_PATTERNS.GET_TOUR)
  async get(@Payload() data: { id: number }): Promise<TourResponseDto> {
    const tour = await this.getTourService.execute(data.id);
    return new TourResponseDto(tour);
  }

  @MessagePattern(BOOKING_PATTERNS.GET_TOUR_BY_SLUG)
  async getBySlug(@Payload() data: { slug: string }): Promise<TourResponseDto> {
    const tour = await this.getTourBySlugService.execute(data.slug);
    return new TourResponseDto(tour);
  }

  @MessagePattern(BOOKING_PATTERNS.CREATE_TOUR_DEPARTURE)
  async createDeparture(
    @Payload() data: CreateTourDepartureDto & { tourId: number },
  ): Promise<TourDepartureResponseDto> {
    const departure = await this.createTourDepartureService.execute({
      tourId: data.tourId,
      departureDate: toInstant(data.departureDate, 'departureDate'),
      capacity: data.capacity,
      priceOverride: data.priceOverride ?? null,
    });
    return new TourDepartureResponseDto(departure);
  }

  @MessagePattern(BOOKING_PATTERNS.LIST_TOUR_DEPARTURES)
  async listDepartures(
    @Payload() data: { tourId: number; from?: string; to?: string },
  ): Promise<TourDepartureResponseDto[]> {
    const departures = await this.listTourDeparturesService.execute({
      tourId: data.tourId,
      range: toOptionalRange(data.from, data.to),
    });
    return departures.map((departure) => new TourDepartureResponseDto(departure));
  }

  @MessagePattern(BOOKING_PATTERNS.SEARCH_AVAILABLE_DEPARTURES)
  async searchAvailable(
    @Payload() data: { from: string; to: string; seats?: number; tourId?: number },
  ): Promise<AvailableDepartureResponseDto[]> {
    const departures = await this.searchAvailableDeparturesService.execute({
      range: toDateRange(data.from, data.to),
      seats: data.seats ?? 1,
      tourId: data.tourId,
    });
    return departures.map((departure) => new AvailableDepartureResponseDto(departure));
  }

  @MessagePattern(BOOKING_PATTERNS.CHECK_TOUR_AVAILABILITY)
  async checkAvailability(
    @Payload() data: { tourId: number; from: string; to: string; seats?: number },
  ): Promise<AvailableDepartureResponseDto[]> {
    const departures = await this.checkTourAvailabilityService.execute({
      tourId: data.tourId,
      range: toDateRange(data.from, data.to),
      seats: data.seats ?? 1,
    });
    return departures.map((departure) => new AvailableDepartureResponseDto(departure));
  }

  @MessagePattern(BOOKING_PATTERNS.LIST_TOUR_BOOKINGS)
  async listBookings(
    @Payload()
    data: {
      tourId: number;
      status?: BookingStatus;
      from?: string;
      to?: string;
      skip?: number;
      take?: number;
    },
  ): Promise<BookingResponseDto[]> {
    const bookings = await this.listTourBookingsService.execute({
      tourId: data.tourId,
      filter: {
        status: data.status,
        range: toOptionalRange(data.from, data.to),
        skip: data.skip,
        take: data.take,
      },
    });
    return bookings.map((booking) => new BookingResponseDto(booking));
  }

  @MessagePattern(BOOKING_PATTERNS.ADD_TOUR_IMAGE)
  async addImage(@Payload() data: AddImageDto & { tourId: number }): Promise<TourImageResponseDto> {
    const image = await this.addTourImageService.execute({
      tourId: data.tourId,
      url: data.url,
      caption: data.caption ?? null,
      position: data.position,
    });
    return new TourImageResponseDto(image);
  }

  @MessagePattern(BOOKING_PATTERNS.REMOVE_TOUR_IMAGE)
  async removeImage(
    @Payload() data: { tourId: number; imageId: number },
  ): Promise<{ deleted: boolean }> {
    await this.removeTourImageService.execute({ tourId: data.tourId, imageId: data.imageId });
    return { deleted: true };
  }

  @MessagePattern(BOOKING_PATTERNS.REORDER_TOUR_IMAGES)
  async reorderImages(
    @Payload() data: ReorderImagesDto & { tourId: number },
  ): Promise<TourImageResponseDto[]> {
    const images = await this.reorderTourImagesService.execute({
      tourId: data.tourId,
      orderedImageIds: data.imageIds,
    });
    return images.map((image) => new TourImageResponseDto(image));
  }
}
