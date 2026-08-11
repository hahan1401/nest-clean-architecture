import type { TourImage } from '@app/database';
import type { AddTourImageData } from '../repositories/tour-image.repository';

export interface AddTourImageUseCase {
  execute(data: AddTourImageData): Promise<TourImage>;
}

export interface RemoveTourImageInput {
  tourId: number;
  imageId: number;
}

export interface RemoveTourImageUseCase {
  execute(input: RemoveTourImageInput): Promise<void>;
}

export interface ReorderTourImagesInput {
  tourId: number;
  /** Every current image id for this tour, each exactly once, in the new order. */
  orderedImageIds: number[];
}

export interface ReorderTourImagesUseCase {
  execute(input: ReorderTourImagesInput): Promise<TourImage[]>;
}
