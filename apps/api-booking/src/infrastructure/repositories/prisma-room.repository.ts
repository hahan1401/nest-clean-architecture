import { PRISMA_SERVICE, Room, type ExtendedPrismaClient } from '@app/database';
import { Inject, Injectable } from '@nestjs/common';
import { DateRange } from '../../domain/models/date-range';
import {
  CreateRoomData,
  RoomListFilter,
  RoomRepository,
} from '../../domain/repositories/room.repository';
import { SLOT_HOLDING_STATUSES } from './booking-status.constants';

@Injectable()
export class PrismaRoomRepository extends RoomRepository {
  constructor(@Inject(PRISMA_SERVICE) private readonly prisma: ExtendedPrismaClient) {
    super();
  }

  async create(data: CreateRoomData): Promise<Room> {
    const room = await this.prisma.room.create({ data });
    return new Room(room);
  }

  async findById(id: string): Promise<Room | null> {
    const room = await this.prisma.room.findUnique({ where: { id } });
    return room ? new Room(room) : null;
  }

  async findByCode(code: string): Promise<Room | null> {
    const room = await this.prisma.room.findUnique({ where: { code } });
    return room ? new Room(room) : null;
  }

  async findMany(filter: RoomListFilter): Promise<Room[]> {
    const rooms = await this.prisma.room.findMany({
      where: {
        isActive: filter.isActive,
        maxGuests: filter.guests ? { gte: filter.guests } : undefined,
      },
      orderBy: [{ basePrice: 'asc' }, { name: 'asc' }],
      skip: filter.skip,
      take: filter.take,
    });
    return rooms.map((room) => new Room(room));
  }

  /**
   * Browse-path search. Reads go to a replica: this is lag-tolerant, and the
   * worst case is showing a room that was taken moments ago, which the exclusion
   * constraint turns into an honest 409 at booking time rather than an overbook.
   *
   * The overlap test is [checkIn, checkOut): an existing booking clashes when it
   * starts before our checkout AND ends after our check-in. Identical semantics
   * to the '[)' daterange in bookings_room_no_overlap, so this can never
   * disagree with the constraint.
   */
  async findAvailable(range: DateRange, filter: RoomListFilter): Promise<Room[]> {
    const rooms = await this.prisma.$replica().room.findMany({
      where: {
        isActive: filter.isActive ?? true,
        maxGuests: filter.guests ? { gte: filter.guests } : undefined,
        bookings: {
          none: {
            status: { in: [...SLOT_HOLDING_STATUSES] },
            checkIn: { lt: range.to },
            checkOut: { gt: range.from },
          },
        },
      },
      orderBy: [{ basePrice: 'asc' }, { name: 'asc' }],
      skip: filter.skip,
      take: filter.take,
    });
    return rooms.map((room) => new Room(room));
  }

  /**
   * Single-room check. Pinned to the primary because this is the question asked
   * immediately before a booking write, and replication lag would report a room
   * as free that was taken 200ms ago.
   */
  async isAvailable(roomId: string, range: DateRange): Promise<boolean> {
    const clash = await this.prisma.$primary().booking.findFirst({
      where: {
        roomId,
        status: { in: [...SLOT_HOLDING_STATUSES] },
        checkIn: { lt: range.to },
        checkOut: { gt: range.from },
      },
      select: { id: true },
    });
    return clash === null;
  }
}
