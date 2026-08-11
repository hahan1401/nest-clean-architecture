import { PRISMA_SERVICE, RoomImage, type ExtendedPrismaClient } from '@app/database';
import { Inject, Injectable } from '@nestjs/common';
import {
  AddRoomImageData,
  RoomImageRepository,
} from '../../domain/repositories/room-image.repository';

@Injectable()
export class PrismaRoomImageRepository extends RoomImageRepository {
  constructor(@Inject(PRISMA_SERVICE) private readonly prisma: ExtendedPrismaClient) {
    super();
  }

  async add(data: AddRoomImageData): Promise<RoomImage> {
    const position = data.position ?? (await this.nextPosition(data.roomId));
    const image = await this.prisma.roomImage.create({
      data: { roomId: data.roomId, url: data.url, caption: data.caption, position },
    });
    return new RoomImage(image);
  }

  async findById(roomId: number, imageId: number): Promise<RoomImage | null> {
    const image = await this.prisma.roomImage.findFirst({ where: { id: imageId, roomId } });
    return image ? new RoomImage(image) : null;
  }

  async findByRoom(roomId: number): Promise<RoomImage[]> {
    const images = await this.prisma.roomImage.findMany({
      where: { roomId },
      orderBy: { position: 'asc' },
    });
    return images.map((image) => new RoomImage(image));
  }

  async remove(roomId: number, imageId: number): Promise<void> {
    // Scoped by roomId, not just id: defence in depth against removing an
    // image that happens to belong to a different room.
    await this.prisma.roomImage.deleteMany({ where: { id: imageId, roomId } });
  }

  /**
   * One transaction so a concurrent reader never observes a half-applied
   * order. $transaction always runs on the primary (see @app/database).
   */
  async reorder(roomId: number, orderedImageIds: number[]): Promise<RoomImage[]> {
    await this.prisma.$transaction(
      orderedImageIds.map((id, index) =>
        this.prisma.roomImage.update({ where: { id }, data: { position: index } }),
      ),
    );
    return this.findByRoom(roomId);
  }

  private async nextPosition(roomId: number): Promise<number> {
    const last = await this.prisma.roomImage.findFirst({
      where: { roomId },
      orderBy: { position: 'desc' },
    });
    return last ? last.position + 1 : 0;
  }
}
