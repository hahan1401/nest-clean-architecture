import { PRISMA_SERVICE, Tour, type ExtendedPrismaClient } from '@app/database';
import { Inject, Injectable } from '@nestjs/common';
import {
  CreateTourData,
  TourListFilter,
  TourRepository,
} from '../../domain/repositories/tour.repository';

@Injectable()
export class PrismaTourRepository extends TourRepository {
  constructor(@Inject(PRISMA_SERVICE) private readonly prisma: ExtendedPrismaClient) {
    super();
  }

  async create(data: CreateTourData): Promise<Tour> {
    const tour = await this.prisma.tour.create({ data });
    return new Tour(tour);
  }

  async findById(id: string): Promise<Tour | null> {
    const tour = await this.prisma.tour.findUnique({ where: { id } });
    return tour ? new Tour(tour) : null;
  }

  async findBySlug(slug: string): Promise<Tour | null> {
    const tour = await this.prisma.tour.findUnique({ where: { slug } });
    return tour ? new Tour(tour) : null;
  }

  async findMany(filter: TourListFilter): Promise<Tour[]> {
    const tours = await this.prisma.tour.findMany({
      where: { isActive: filter.isActive },
      orderBy: { name: 'asc' },
      skip: filter.skip,
      take: filter.take,
    });
    return tours.map((tour) => new Tour(tour));
  }
}
