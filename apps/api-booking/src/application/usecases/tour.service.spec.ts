import { NotFoundError } from '@app/common';
import { Tour } from '@app/database';
import { TourRepository } from '../../domain/repositories/tour.repository';
import { GetTourBySlugService } from './tour.service';

const tour = (overrides: Partial<Tour> = {}): Tour =>
  new Tour({
    id: 1,
    slug: 'cau-dat-sunrise',
    name: 'Sunrise over the Cầu Đất tea terraces',
    description: 'Leave in the dark, arrive as the fog burns off the rows.',
    durationDays: 1,
    basePricePerPerson: 690_000,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

describe('GetTourBySlugService', () => {
  let tourRepository: jest.Mocked<TourRepository>;
  let service: GetTourBySlugService;

  beforeEach(() => {
    tourRepository = {
      findBySlug: jest.fn(),
    } as unknown as jest.Mocked<TourRepository>;
    service = new GetTourBySlugService(tourRepository);
  });

  it('returns the tour behind a public /journeys/<slug> URL', async () => {
    tourRepository.findBySlug.mockResolvedValue(tour());

    const result = await service.execute('cau-dat-sunrise');

    expect(result.slug).toBe('cau-dat-sunrise');
    expect(tourRepository.findBySlug).toHaveBeenCalledWith('cau-dat-sunrise');
  });

  it('throws NotFound for an unknown slug', async () => {
    tourRepository.findBySlug.mockResolvedValue(null);

    await expect(service.execute('nope')).rejects.toBeInstanceOf(NotFoundError);
  });
});
