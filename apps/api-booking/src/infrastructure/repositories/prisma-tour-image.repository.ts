import { PRISMA_SERVICE, TourImage, type ExtendedPrismaClient } from '@app/database';
import { Inject, Injectable } from '@nestjs/common';
import {
  AddTourImageData,
  TourImageRepository,
} from '../../domain/repositories/tour-image.repository';

@Injectable()
export class PrismaTourImageRepository extends TourImageRepository {
  constructor(@Inject(PRISMA_SERVICE) private readonly prisma: ExtendedPrismaClient) {
    super();
  }

  async add(data: AddTourImageData): Promise<TourImage> {
    const position = data.position ?? (await this.nextPosition(data.tourId));
    const image = await this.prisma.tourImage.create({
      data: { tourId: data.tourId, url: data.url, caption: data.caption, position },
    });
    return new TourImage(image);
  }

  async findById(tourId: number, imageId: number): Promise<TourImage | null> {
    const image = await this.prisma.tourImage.findFirst({ where: { id: imageId, tourId } });
    return image ? new TourImage(image) : null;
  }

  async findByTour(tourId: number): Promise<TourImage[]> {
    const images = await this.prisma.tourImage.findMany({
      where: { tourId },
      orderBy: { position: 'asc' },
    });
    return images.map((image) => new TourImage(image));
  }

  async remove(tourId: number, imageId: number): Promise<void> {
    // Scoped by tourId, not just id: defence in depth against removing an
    // image that happens to belong to a different tour.
    await this.prisma.tourImage.deleteMany({ where: { id: imageId, tourId } });
  }

  /**
   * One transaction so a concurrent reader never observes a half-applied
   * order. $transaction always runs on the primary (see @app/database).
   */
  async reorder(tourId: number, orderedImageIds: number[]): Promise<TourImage[]> {
    await this.prisma.$transaction(
      orderedImageIds.map((id, index) =>
        this.prisma.tourImage.update({ where: { id }, data: { position: index } }),
      ),
    );
    return this.findByTour(tourId);
  }

  private async nextPosition(tourId: number): Promise<number> {
    const last = await this.prisma.tourImage.findFirst({
      where: { tourId },
      orderBy: { position: 'desc' },
    });
    return last ? last.position + 1 : 0;
  }
}
