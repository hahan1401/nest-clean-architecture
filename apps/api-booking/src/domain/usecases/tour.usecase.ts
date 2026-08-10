import type { AvailableDeparture, Booking, Tour, TourDeparture } from '@app/database';
import type { DateRange } from '../models/date-range';
import type { BookingHistoryFilter } from '../repositories/booking.repository';
import type { CreateTourDepartureData } from '../repositories/tour-departure.repository';
import type { CreateTourData, TourListFilter } from '../repositories/tour.repository';

export interface CreateTourUseCase {
  execute(data: CreateTourData): Promise<Tour>;
}

export interface ListToursUseCase {
  execute(filter: TourListFilter): Promise<Tour[]>;
}

export interface GetTourUseCase {
  execute(id: string): Promise<Tour>;
}

/** Lookup by the human-readable `Tour.slug`, so public URLs need no uuid. */
export interface GetTourBySlugUseCase {
  execute(slug: string): Promise<Tour>;
}

export interface CreateTourDepartureUseCase {
  execute(data: CreateTourDepartureData): Promise<TourDeparture>;
}

export interface ListTourDeparturesInput {
  tourId: string;
  range?: DateRange;
}

export interface ListTourDeparturesUseCase {
  execute(input: ListTourDeparturesInput): Promise<TourDeparture[]>;
}

export interface SearchAvailableDeparturesInput {
  range: DateRange;
  seats: number;
  tourId?: string;
}

export interface SearchAvailableDeparturesUseCase {
  execute(input: SearchAvailableDeparturesInput): Promise<AvailableDeparture[]>;
}

export interface CheckTourAvailabilityUseCase {
  execute(
    input: SearchAvailableDeparturesInput & { tourId: string },
  ): Promise<AvailableDeparture[]>;
}

export interface ListTourBookingsInput {
  tourId: string;
  filter: BookingHistoryFilter;
}

export interface ListTourBookingsUseCase {
  execute(input: ListTourBookingsInput): Promise<Booking[]>;
}
