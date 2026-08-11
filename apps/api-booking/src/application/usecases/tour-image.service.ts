import { NotFoundError, ValidationError } from '@app/common';
import { TourImage } from '@app/database';
import { Injectable } from '@nestjs/common';
import {
  AddTourImageData,
  TourImageRepository,
} from '../../domain/repositories/tour-image.repository';
import { TourRepository } from '../../domain/repositories/tour.repository';
import {
  AddTourImageUseCase,
  RemoveTourImageInput,
  RemoveTourImageUseCase,
  ReorderTourImagesInput,
  ReorderTourImagesUseCase,
} from '../../domain/usecases/tour-image.usecase';

@Injectable()
export class AddTourImageService implements AddTourImageUseCase {
  constructor(
    private readonly tourRepository: TourRepository,
    private readonly tourImageRepository: TourImageRepository,
  ) {}

  async execute(data: AddTourImageData): Promise<TourImage> {
    const tour = await this.tourRepository.findById(data.tourId);
    if (!tour) {
      throw new NotFoundError(`Tour with id ${data.tourId} not found`);
    }
    return this.tourImageRepository.add(data);
  }
}

@Injectable()
export class RemoveTourImageService implements RemoveTourImageUseCase {
  constructor(private readonly tourImageRepository: TourImageRepository) {}

  async execute(input: RemoveTourImageInput): Promise<void> {
    const image = await this.tourImageRepository.findById(input.tourId, input.imageId);
    if (!image) {
      throw new NotFoundError(`Image ${input.imageId} not found on tour ${input.tourId}`);
    }
    await this.tourImageRepository.remove(input.tourId, input.imageId);
  }
}

@Injectable()
export class ReorderTourImagesService implements ReorderTourImagesUseCase {
  constructor(
    private readonly tourRepository: TourRepository,
    private readonly tourImageRepository: TourImageRepository,
  ) {}

  async execute(input: ReorderTourImagesInput): Promise<TourImage[]> {
    const tour = await this.tourRepository.findById(input.tourId);
    if (!tour) {
      throw new NotFoundError(`Tour with id ${input.tourId} not found`);
    }

    const images = await this.tourImageRepository.findByTour(input.tourId);
    const currentIds = new Set(images.map((image) => image.id));
    const requestedIds = input.orderedImageIds;
    const requestedIdSet = new Set(requestedIds);

    const isPermutation =
      requestedIdSet.size === requestedIds.length &&
      requestedIdSet.size === currentIds.size &&
      [...requestedIdSet].every((id) => currentIds.has(id));
    if (!isPermutation) {
      throw new ValidationError(
        "orderedImageIds must list exactly the tour's current image ids, each exactly once",
      );
    }

    return this.tourImageRepository.reorder(input.tourId, requestedIds);
  }
}
