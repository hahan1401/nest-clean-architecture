import { PRISMA_SERVICE, Tour, TourImage, type ExtendedPrismaClient } from '@app/database';
import { Inject, Injectable } from '@nestjs/common';
import {
  CreateTourData,
  TourListFilter,
  TourRepository,
} from '../../domain/repositories/tour.repository';

/** Every tour read includes its images, ordered for display. */
const IMAGES_INCLUDE = { images: { orderBy: { position: 'asc' as const } } };

@Injectable()
export class PrismaTourRepository extends TourRepository {
  constructor(@Inject(PRISMA_SERVICE) private readonly prisma: ExtendedPrismaClient) {
    super();
  }

  async create(data: CreateTourData): Promise<Tour> {
    const tour = await this.prisma.tour.create({ data });
    // A brand-new tour has no images yet; skip the include rather than pay
    // for a query that can only return an empty array.
    return new Tour({ ...tour, images: [] });
  }

  async findById(id: number): Promise<Tour | null> {
    const tour = await this.prisma.tour.findUnique({
      where: { id },
      include: IMAGES_INCLUDE,
    });
    return tour ? this.toEntity(tour) : null;
  }

  async findBySlug(slug: string): Promise<Tour | null> {
    const tour = await this.prisma.tour.findUnique({
      where: { slug },
      include: IMAGES_INCLUDE,
    });
    return tour ? this.toEntity(tour) : null;
  }

  async findMany(filter: TourListFilter): Promise<Tour[]> {
    const tours = await this.prisma.tour.findMany({
      where: { isActive: filter.isActive },
      include: IMAGES_INCLUDE,
      orderBy: { name: 'asc' },
      skip: filter.skip,
      take: filter.take,
    });
    return tours.map((tour) => this.toEntity(tour));
  }

  private toEntity(tour: {
    images: Array<{
      id: number;
      tourId: number;
      url: string;
      position: number;
      caption: string | null;
      createdAt: Date;
      updatedAt: Date;
    }>;
    [key: string]: unknown;
  }): Tour {
    const { images, ...rest } = tour;
    return new Tour({ ...rest, images: images.map((image) => new TourImage(image)) });
  }
}
