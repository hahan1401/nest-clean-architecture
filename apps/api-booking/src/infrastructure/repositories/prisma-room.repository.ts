import { BookingStatus, PRISMA_SERVICE, Room, type ExtendedPrismaClient } from '@app/database';
import { Inject, Injectable } from '@nestjs/common';
import type { RoomAvailabilityState, RoomOffer } from '../../domain/models/availability';
import { DateRange, TURNOVER_MS, occupancyWindow } from '../../domain/models/date-range';
import {
  CreateRoomData,
  RoomListFilter,
  RoomRepository,
} from '../../domain/repositories/room.repository';
import { SLOT_HOLDING_STATUSES } from './booking-status.constants';

/**
 * Same terms as the tstzrange constraint: the two *occupancy* windows overlap.
 *
 * A stored stay clashes with the requested one when it starts before the request
 * gives the room back (`checkIn < to + turnover`) and gives the room back after
 * the request starts (`checkOut + turnover > from`). The second is written as
 * `checkOut > from - turnover` so the comparison is against a column rather than
 * an expression, which is the same inequality with the hour moved to the other
 * side, and lets the index be used.
 */
export const overlapping = (range: DateRange) => ({
  checkIn: { lt: occupancyWindow(range).to },
  checkOut: { gt: new Date(range.from.getTime() - TURNOVER_MS) },
});

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
   * The overlap test is over occupancy windows - the stay plus its turnover hour
   * - and is identical to the '[)' tstzrange in bookings_room_no_overlap, so
   * this can never disagree with the constraint. Same-day turnover still works:
   * a guest leaving at 11:00 and one arriving at 13:00 do not collide, while one
   * arriving at 11:30 now does.
   *
   * Every room the guest count fits is returned, sold ones included. A guest
   * looking at a full house still wants to see what the house has and when it
   * frees up; hiding those rows just makes the search look broken.
   */
  async findAvailable(range: DateRange, filter: RoomListFilter): Promise<RoomOffer[]> {
    const overlaps = overlapping(range);

    const rooms = await this.prisma.$replica().room.findMany({
      where: {
        isActive: filter.isActive ?? true,
        maxGuests: filter.guests ? { gte: filter.guests } : undefined,
      },
      include: {
        bookings: {
          where: { status: { in: [...SLOT_HOLDING_STATUSES] }, ...overlaps },
          select: { status: true, holdExpiresAt: true, checkOut: true },
        },
      },
      orderBy: [{ basePrice: 'asc' }, { name: 'asc' }],
      skip: filter.skip,
      take: filter.take,
    });

    return rooms.map(({ bookings, ...room }) => {
      const sold = bookings.filter((b) => b.status !== BookingStatus.PENDING);
      const holds = bookings.filter((b) => b.status === BookingStatus.PENDING);

      // Sold outranks held: however the holds resolve, the window as a whole
      // cannot free up before the last sold stay ends.
      if (sold.length > 0) {
        return {
          room: new Room(room),
          held: false,
          heldUntil: null,
          availableFrom: readyFrom([...sold, ...holds]),
        };
      }

      return {
        room: new Room(room),
        held: holds.length > 0,
        heldUntil: latestHoldExpiry(holds),
        availableFrom: null,
      };
    });
  }

  /**
   * Single-room check. Pinned to the primary because this is the question asked
   * immediately before a booking write, and replication lag would report a room
   * as free that was taken 200ms ago.
   */
  async checkAvailability(
    roomId: number,
    range: DateRange,
  ): Promise<{
    state: RoomAvailabilityState;
    heldUntil: Date | null;
    availableFrom: Date | null;
  }> {
    const clashes = await this.prisma.$primary().booking.findMany({
      where: {
        roomId,
        // Still the full slot-holding list: this answers "may a write proceed",
        // and PENDING blocks the exclusion constraint just as CONFIRMED does.
        status: { in: [...SLOT_HOLDING_STATUSES] },
        ...overlapping(range),
      },
      select: { status: true, holdExpiresAt: true, checkOut: true },
    });

    if (clashes.length === 0) {
      return { state: 'AVAILABLE', heldUntil: null, availableFrom: null };
    }

    // A single sold night outranks any number of holds: the window as a whole
    // cannot free up, however the holds resolve.
    if (clashes.some((clash) => clash.status !== BookingStatus.PENDING)) {
      return { state: 'BOOKED', heldUntil: null, availableFrom: readyFrom(clashes) };
    }

    return { state: 'ON_HOLD', heldUntil: latestHoldExpiry(clashes), availableFrom: null };
  }
}

/**
 * When the room is ready again: the checkout of the last stay overlapping the
 * requested window, plus the turnover hour. A guest reading "free from 16:00"
 * can act on it - 15:00 would be the moment the room empties, not the moment it
 * can be taken, and offering that instant back would earn them a 409.
 *
 * Not "the next window that fits" - that is a different and much more expensive
 * question, and this one is what the guest is owed first.
 */
function readyFrom(stays: Array<{ checkOut: Date | null }>): Date | null {
  const ends = stays.map((s) => s.checkOut).filter((end): end is Date => end !== null);
  return ends.length === 0
    ? null
    : new Date(Math.max(...ends.map((end) => end.getTime())) + TURNOVER_MS);
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
