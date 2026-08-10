import type { AvailableDeparture, TourDeparture } from '@app/database';
import type { DateRange } from '../models/date-range';

export interface CreateTourDepartureData {
  tourId: number;
  departureDate: Date;
  capacity: number;
  priceOverride: number | null;
}

export abstract class TourDepartureRepository {
  abstract create(data: CreateTourDepartureData): Promise<TourDeparture>;
  abstract findById(id: number): Promise<TourDeparture | null>;
  abstract findByTourAndDate(tourId: number, departureDate: Date): Promise<TourDeparture | null>;
  abstract findByTour(tourId: number, range?: DateRange): Promise<TourDeparture[]>;

  /** OPEN departures inside `range` with at least `seats` free, newest date first. */
  abstract findAvailable(
    range: DateRange,
    seats: number,
    tourId?: number,
  ): Promise<AvailableDeparture[]>;
}
