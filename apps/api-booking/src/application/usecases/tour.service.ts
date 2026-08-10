import { ConflictError, NotFoundError, ValidationError } from '@app/common';
import { AvailableDeparture, Booking, Tour, TourDeparture } from '@app/database';
import { Injectable } from '@nestjs/common';
import { todayUtc } from '../../domain/models/date-range';
import { BookingRepository } from '../../domain/repositories/booking.repository';
import {
  CreateTourDepartureData,
  TourDepartureRepository,
} from '../../domain/repositories/tour-departure.repository';
import {
  CreateTourData,
  TourListFilter,
  TourRepository,
} from '../../domain/repositories/tour.repository';
import {
  CheckTourAvailabilityUseCase,
  CreateTourDepartureUseCase,
  CreateTourUseCase,
  GetTourBySlugUseCase,
  GetTourUseCase,
  ListTourBookingsInput,
  ListTourBookingsUseCase,
  ListTourDeparturesInput,
  ListTourDeparturesUseCase,
  ListToursUseCase,
  SearchAvailableDeparturesInput,
  SearchAvailableDeparturesUseCase,
} from '../../domain/usecases/tour.usecase';
import { assertUsableRange } from './room.service';

@Injectable()
export class CreateTourService implements CreateTourUseCase {
  constructor(private readonly tourRepository: TourRepository) {}

  async execute(data: CreateTourData): Promise<Tour> {
    const existing = await this.tourRepository.findBySlug(data.slug);
    if (existing) {
      throw new ConflictError(`Tour with slug ${data.slug} already exists`);
    }
    return this.tourRepository.create(data);
  }
}

@Injectable()
export class ListToursService implements ListToursUseCase {
  constructor(private readonly tourRepository: TourRepository) {}

  execute(filter: TourListFilter): Promise<Tour[]> {
    return this.tourRepository.findMany(filter);
  }
}

@Injectable()
export class GetTourService implements GetTourUseCase {
  constructor(private readonly tourRepository: TourRepository) {}

  async execute(id: string): Promise<Tour> {
    const tour = await this.tourRepository.findById(id);
    if (!tour) {
      throw new NotFoundError(`Tour with id ${id} not found`);
    }
    return tour;
  }
}

/**
 * Backs the public `/journeys/<slug>` URLs. `Tour.slug` is unique, so this is a
 * single indexed lookup - no different in cost from the id path.
 */
@Injectable()
export class GetTourBySlugService implements GetTourBySlugUseCase {
  constructor(private readonly tourRepository: TourRepository) {}

  async execute(slug: string): Promise<Tour> {
    const tour = await this.tourRepository.findBySlug(slug);
    if (!tour) {
      throw new NotFoundError(`Tour with slug ${slug} not found`);
    }
    return tour;
  }
}

@Injectable()
export class CreateTourDepartureService implements CreateTourDepartureUseCase {
  constructor(
    private readonly tourRepository: TourRepository,
    private readonly departureRepository: TourDepartureRepository,
  ) {}

  async execute(data: CreateTourDepartureData): Promise<TourDeparture> {
    if (data.capacity < 1) {
      throw new ValidationError('capacity must be at least 1');
    }
    if (data.departureDate < todayUtc()) {
      throw new ValidationError('departureDate cannot be in the past');
    }

    const tour = await this.tourRepository.findById(data.tourId);
    if (!tour) {
      throw new NotFoundError(`Tour with id ${data.tourId} not found`);
    }

    const existing = await this.departureRepository.findByTourAndDate(
      data.tourId,
      data.departureDate,
    );
    if (existing) {
      throw new ConflictError(
        `Tour ${tour.slug} already has a departure on ${data.departureDate.toISOString().slice(0, 10)}`,
      );
    }

    return this.departureRepository.create(data);
  }
}

@Injectable()
export class ListTourDeparturesService implements ListTourDeparturesUseCase {
  constructor(
    private readonly tourRepository: TourRepository,
    private readonly departureRepository: TourDepartureRepository,
  ) {}

  async execute(input: ListTourDeparturesInput): Promise<TourDeparture[]> {
    const tour = await this.tourRepository.findById(input.tourId);
    if (!tour) {
      throw new NotFoundError(`Tour with id ${input.tourId} not found`);
    }
    return this.departureRepository.findByTour(tour.id, input.range);
  }
}

@Injectable()
export class SearchAvailableDeparturesService implements SearchAvailableDeparturesUseCase {
  constructor(private readonly departureRepository: TourDepartureRepository) {}

  execute(input: SearchAvailableDeparturesInput): Promise<AvailableDeparture[]> {
    assertUsableRange(input.range);
    if (input.seats < 1) {
      throw new ValidationError('seats must be at least 1');
    }
    return this.departureRepository.findAvailable(input.range, input.seats, input.tourId);
  }
}

@Injectable()
export class CheckTourAvailabilityService implements CheckTourAvailabilityUseCase {
  constructor(
    private readonly tourRepository: TourRepository,
    private readonly departureRepository: TourDepartureRepository,
  ) {}

  async execute(
    input: SearchAvailableDeparturesInput & { tourId: string },
  ): Promise<AvailableDeparture[]> {
    assertUsableRange(input.range);
    if (input.seats < 1) {
      throw new ValidationError('seats must be at least 1');
    }

    const tour = await this.tourRepository.findById(input.tourId);
    if (!tour) {
      throw new NotFoundError(`Tour with id ${input.tourId} not found`);
    }

    return this.departureRepository.findAvailable(input.range, input.seats, tour.id);
  }
}

@Injectable()
export class ListTourBookingsService implements ListTourBookingsUseCase {
  constructor(
    private readonly tourRepository: TourRepository,
    private readonly bookingRepository: BookingRepository,
  ) {}

  async execute(input: ListTourBookingsInput): Promise<Booking[]> {
    const tour = await this.tourRepository.findById(input.tourId);
    if (!tour) {
      throw new NotFoundError(`Tour with id ${input.tourId} not found`);
    }
    return this.bookingRepository.findByTour(tour.id, input.filter);
  }
}
