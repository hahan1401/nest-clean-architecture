import { NotFoundError, ValidationError } from '@app/common';
import { Tour, TourImage } from '@app/database';
import { TourImageRepository } from '../../domain/repositories/tour-image.repository';
import { TourRepository } from '../../domain/repositories/tour.repository';
import {
  AddTourImageService,
  RemoveTourImageService,
  ReorderTourImagesService,
} from './tour-image.service';

const tour = (overrides: Partial<Tour> = {}): Tour =>
  new Tour({
    id: 1,
    slug: 'cau-dat-sunrise',
    name: 'Cầu Đất Sunrise',
    description: null,
    durationDays: 1,
    basePricePerPerson: 450_000,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

const image = (overrides: Partial<TourImage> = {}): TourImage =>
  new TourImage({
    id: 1,
    tourId: 1,
    url: 'https://images.example.com/sunrise-1.jpg',
    position: 0,
    caption: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

describe('AddTourImageService', () => {
  let tourRepository: jest.Mocked<TourRepository>;
  let tourImageRepository: jest.Mocked<TourImageRepository>;
  let service: AddTourImageService;

  beforeEach(() => {
    tourRepository = { findById: jest.fn() } as unknown as jest.Mocked<TourRepository>;
    tourImageRepository = { add: jest.fn() } as unknown as jest.Mocked<TourImageRepository>;
    service = new AddTourImageService(tourRepository, tourImageRepository);
  });

  it('adds the image once the tour is confirmed to exist', async () => {
    tourRepository.findById.mockResolvedValue(tour());
    tourImageRepository.add.mockResolvedValue(image());

    const result = await service.execute({
      tourId: 1,
      url: 'https://images.example.com/sunrise-1.jpg',
      caption: null,
    });

    expect(result.id).toBe(1);
    expect(tourImageRepository.add).toHaveBeenCalledWith({
      tourId: 1,
      url: 'https://images.example.com/sunrise-1.jpg',
      caption: null,
    });
  });

  it('throws NotFound rather than attaching an image to a nonexistent tour', async () => {
    tourRepository.findById.mockResolvedValue(null);

    await expect(
      service.execute({ tourId: 99, url: 'https://images.example.com/x.jpg', caption: null }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(tourImageRepository.add).not.toHaveBeenCalled();
  });
});

describe('RemoveTourImageService', () => {
  let tourImageRepository: jest.Mocked<TourImageRepository>;
  let service: RemoveTourImageService;

  beforeEach(() => {
    tourImageRepository = {
      findById: jest.fn(),
      remove: jest.fn(),
    } as unknown as jest.Mocked<TourImageRepository>;
    service = new RemoveTourImageService(tourImageRepository);
  });

  it('removes an image that belongs to the tour', async () => {
    tourImageRepository.findById.mockResolvedValue(image());

    await service.execute({ tourId: 1, imageId: 1 });

    expect(tourImageRepository.remove).toHaveBeenCalledWith(1, 1);
  });

  it('throws NotFound for an image that is absent or belongs to another tour', async () => {
    tourImageRepository.findById.mockResolvedValue(null);

    await expect(service.execute({ tourId: 1, imageId: 404 })).rejects.toBeInstanceOf(
      NotFoundError,
    );
    expect(tourImageRepository.remove).not.toHaveBeenCalled();
  });
});

describe('ReorderTourImagesService', () => {
  let tourRepository: jest.Mocked<TourRepository>;
  let tourImageRepository: jest.Mocked<TourImageRepository>;
  let service: ReorderTourImagesService;

  beforeEach(() => {
    tourRepository = {
      findById: jest.fn().mockResolvedValue(tour()),
    } as unknown as jest.Mocked<TourRepository>;
    tourImageRepository = {
      findByTour: jest.fn(),
      reorder: jest.fn(),
    } as unknown as jest.Mocked<TourImageRepository>;
    service = new ReorderTourImagesService(tourRepository, tourImageRepository);
  });

  it('reorders when the request is exactly a permutation of the current images', async () => {
    tourImageRepository.findByTour.mockResolvedValue([
      image({ id: 1, position: 0 }),
      image({ id: 2, position: 1 }),
    ]);
    tourImageRepository.reorder.mockResolvedValue([
      image({ id: 2, position: 0 }),
      image({ id: 1, position: 1 }),
    ]);

    const result = await service.execute({ tourId: 1, orderedImageIds: [2, 1] });

    expect(tourImageRepository.reorder).toHaveBeenCalledWith(1, [2, 1]);
    expect(result.map((img) => img.id)).toEqual([2, 1]);
  });

  it('rejects a list missing one of the tour current images', async () => {
    tourImageRepository.findByTour.mockResolvedValue([
      image({ id: 1, position: 0 }),
      image({ id: 2, position: 1 }),
    ]);

    await expect(service.execute({ tourId: 1, orderedImageIds: [1] })).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect(tourImageRepository.reorder).not.toHaveBeenCalled();
  });

  it('rejects a list carrying an id from another tour', async () => {
    tourImageRepository.findByTour.mockResolvedValue([image({ id: 1, position: 0 })]);

    await expect(service.execute({ tourId: 1, orderedImageIds: [1, 999] })).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it('throws NotFound for an unknown tour', async () => {
    tourRepository.findById.mockResolvedValue(null);

    await expect(service.execute({ tourId: 99, orderedImageIds: [] })).rejects.toBeInstanceOf(
      NotFoundError,
    );
    expect(tourImageRepository.findByTour).not.toHaveBeenCalled();
  });
});
