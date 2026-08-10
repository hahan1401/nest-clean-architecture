import { BookingStatus, PRISMA_SERVICE, Room, type ExtendedPrismaClient } from '@app/database';
import { Inject, Injectable } from '@nestjs/common';
import type { RoomAvailabilityState, RoomOffer } from '../../domain/models/availability';
import { DateRange } from '../../domain/models/date-range';
import {
  CreateRoomData,
  RoomListFilter,
  RoomRepository,
} from '../../domain/repositories/room.repository';
import { BOOKED_STATUSES, SLOT_HOLDING_STATUSES } from './booking-status.constants';

@Injectable()
export class PrismaRoomRepository extends RoomRepository {
  constructor(@Inject(PRISMA_SERVICE) private readonly prisma: ExtendedPrismaClient) {
    super();
  }

  async create(data: CreateRoomData): Promise<Room> {
    const room = await this.prisma.room.create({ data });
    return new Room(room);
  }

  async findById(id: number): Promise<Room | null> {
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
  async findAvailable(range: DateRange, filter: RoomListFilter): Promise<RoomOffer[]> {
    const overlaps = { checkIn: { lt: range.to }, checkOut: { gt: range.from } };

    const rooms = await this.prisma.$replica().room.findMany({
      where: {
        isActive: filter.isActive ?? true,
        maxGuests: filter.guests ? { gte: filter.guests } : undefined,
        // Only genuinely sold rooms are excluded. A PENDING overlap is reported
        // rather than hidden, so a guest can wait the hold out.
        bookings: { none: { status: { in: [...BOOKED_STATUSES] }, ...overlaps } },
      },
      include: {
        bookings: {
          where: { status: BookingStatus.PENDING, ...overlaps },
          select: { holdExpiresAt: true },
        },
      },
      orderBy: [{ basePrice: 'asc' }, { name: 'asc' }],
      skip: filter.skip,
      take: filter.take,
    });

    return rooms.map(({ bookings, ...room }) => ({
      room: new Room(room),
      held: bookings.length > 0,
      heldUntil: latestHoldExpiry(bookings),
    }));
  }

  /**
   * Single-room check. Pinned to the primary because this is the question asked
   * immediately before a booking write, and replication lag would report a room
   * as free that was taken 200ms ago.
   */
  async checkAvailability(
    roomId: number,
    range: DateRange,
  ): Promise<{ state: RoomAvailabilityState; heldUntil: Date | null }> {
    const clashes = await this.prisma.$primary().booking.findMany({
      where: {
        roomId,
        // Still the full slot-holding list: this answers "may a write proceed",
        // and PENDING blocks the exclusion constraint just as CONFIRMED does.
        status: { in: [...SLOT_HOLDING_STATUSES] },
        checkIn: { lt: range.to },
        checkOut: { gt: range.from },
      },
      select: { status: true, holdExpiresAt: true },
    });

    if (clashes.length === 0) {
      return { state: 'AVAILABLE', heldUntil: null };
    }

    // A single sold night outranks any number of holds: the window as a whole
    // cannot free up, however the holds resolve.
    if (clashes.some((clash) => clash.status !== BookingStatus.PENDING)) {
      return { state: 'BOOKED', heldUntil: null };
    }

    return { state: 'ON_HOLD', heldUntil: latestHoldExpiry(clashes) };
  }
}

/**
 * The window frees up only when the last overlapping hold lapses, so this takes
 * the maximum rather than the soonest. Null when nothing carries an expiry.
 */
function latestHoldExpiry(holds: Array<{ holdExpiresAt: Date | null }>): Date | null {
  const expiries = holds
    .map((hold) => hold.holdExpiresAt)
    .filter((expiry): expiry is Date => expiry !== null);

  if (expiries.length === 0) {
    return null;
  }

  return new Date(Math.max(...expiries.map((expiry) => expiry.getTime())));
}
