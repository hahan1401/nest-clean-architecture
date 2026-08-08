import type { AvailableDeparture, TourDeparture } from '@app/database';
import type { DateRange } from '../models/date-range';

export interface CreateTourDepartureData {
  tourId: string;
  departureDate: Date;
  capacity: number;
  priceOverride: number | null;
}

export abstract class TourDepartureRepository {
  abstract create(data: CreateTourDepartureData): Promise<TourDeparture>;
  abstract findById(id: string): Promise<TourDeparture | null>;
  abstract findByTourAndDate(tourId: string, departureDate: Date): Promise<TourDeparture | null>;
  abstract findByTour(tourId: string, range?: DateRange): Promise<TourDeparture[]>;

  /** OPEN departures inside `range` with at least `seats` free, newest date first. */
  abstract findAvailable(
    range: DateRange,
    seats: number,
    tourId?: string,
  ): Promise<AvailableDeparture[]>;
}
