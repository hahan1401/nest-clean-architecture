import type { TourImage } from '@app/database';

export interface AddTourImageData {
  tourId: number;
  url: string;
  caption: string | null;
  /** Appended after the current highest position when omitted. */
  position?: number;
}

export abstract class TourImageRepository {
  abstract add(data: AddTourImageData): Promise<TourImage>;
  abstract findById(tourId: number, imageId: number): Promise<TourImage | null>;
  /** Ordered ascending by position. */
  abstract findByTour(tourId: number): Promise<TourImage[]>;
  abstract remove(tourId: number, imageId: number): Promise<void>;
  /** Rewrites position to match `orderedImageIds`, 0-based, then returns the new order. */
  abstract reorder(tourId: number, orderedImageIds: number[]): Promise<TourImage[]>;
}
