import {
  BookableType,
  Booking,
  BookingLine,
  BookingStatus,
  PRISMA_SERVICE,
  PriceQuote,
  type ExtendedPrismaClient,
  type ExtendedTransactionClient,
} from '@app/database';
import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BookingDetail } from '../../domain/models/booking-detail';
import {
  BookingHistoryFilter,
  BookingRepository,
  CreateRoomBookingData,
  CreateTourBookingData,
} from '../../domain/repositories/booking.repository';
import { ACTIVE_STATUSES } from './booking-status.constants';

const ROOM_OVERLAP_CONSTRAINT = 'bookings_room_no_overlap';

/**
 * Postgres raises 23P01 (exclusion_violation) when two bookings overlap. Prisma
 * has no mapped error code for exclusion violations - it only maps 23505 to
 * P2002 - and the wrapper class differs between the model API and raw queries,
 * so match on the constraint name, which Postgres always includes in the
 * message, with the SQLSTATE as a fallback.
 */
const isRoomOverlapViolation = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes(ROOM_OVERLAP_CONSTRAINT) || message.includes('23P01');
};

const toBooking = (
  row: Prisma.BookingGetPayload<{ include: { lines: true } }> | Prisma.BookingGetPayload<object>,
): Booking => {
  const lines = 'lines' in row && Array.isArray(row.lines) ? row.lines : undefined;
  return new Booking({
    ...row,
    lines: lines?.map((line) => new BookingLine(line)),
  });
};

@Injectable()
export class PrismaBookingRepository extends BookingRepository {
  constructor(@Inject(PRISMA_SERVICE) private readonly prisma: ExtendedPrismaClient) {
    super();
  }

  /** Frozen price lines, derived from the same quote object as totalAmount. */
  private lineData(bookingId: number, quote: PriceQuote) {
    return quote.lines.map((line) => ({
      bookingId,
      lineDate: line.date,
      quantity: line.quantity,
      unitAmount: line.unitAmount,
      amount: line.amount,
      priceSource: line.source,
      priceRuleId: line.priceRuleId,
    }));
  }

  private async writeLines(
    tx: ExtendedTransactionClient,
    bookingId: number,
    quote: PriceQuote,
  ): Promise<void> {
    await tx.bookingLine.createMany({ data: this.lineData(bookingId, quote) });
  }

  async createRoomBooking(data: CreateRoomBookingData): Promise<Booking | null> {
    try {
      // $transaction always runs on the primary, so no $primary() calls inside.
      return await this.prisma.$transaction(async (tx) => {
        // The exclusion constraint fires on this insert. A concurrent
        // overlapping writer either blocked on our xid or we blocked on theirs;
        // the loser gets 23P01 and this whole transaction rolls back.
        const booking = await tx.booking.create({
          data: {
            reference: data.reference,
            cancellationToken: data.cancellationToken,
            type: BookableType.ROOM,
            status: BookingStatus.PENDING,
            roomId: data.roomId,
            checkIn: data.range.from,
            checkOut: data.range.to,
            guests: data.guests,
            customerName: data.customer.name,
            customerEmail: data.customer.email,
            customerPhone: data.customer.phone,
            totalAmount: data.quote.total,
            currency: data.quote.currency,
            notes: data.notes,
            holdExpiresAt: data.holdExpiresAt,
          },
        });

        await this.writeLines(tx, booking.id, data.quote);
        return toBooking(booking);
      });
    } catch (error: unknown) {
      if (isRoomOverlapViolation(error)) {
        return null;
      }
      throw error;
    }
  }

  async createTourBooking(data: CreateTourBookingData): Promise<Booking | null> {
    return this.prisma.$transaction(async (tx) => {
      // The conditional UPDATE is the seat guard. Under READ COMMITTED a second
      // transaction blocks on the row lock, then Postgres re-evaluates this
      // WHERE against the newly committed row (EvalPlanQual) - so the loser sees
      // the incremented counter and matches zero rows. No FOR UPDATE, no retry.
      const held = await tx.$executeRaw`
        UPDATE "tour_departures"
        SET "booked_seats" = "booked_seats" + ${data.seats},
            "updated_at" = NOW()
        WHERE "id" = ${data.tourDepartureId}
          AND "status" = 'OPEN'
          AND "booked_seats" + ${data.seats} <= "capacity"
      `;

      if (held === 0) {
        return null;
      }

      const booking = await tx.booking.create({
        data: {
          reference: data.reference,
          cancellationToken: data.cancellationToken,
          type: BookableType.TOUR,
          status: BookingStatus.PENDING,
          tourDepartureId: data.tourDepartureId,
          seats: data.seats,
          guests: data.guests,
          customerName: data.customer.name,
          customerEmail: data.customer.email,
          customerPhone: data.customer.phone,
          totalAmount: data.quote.total,
          currency: data.quote.currency,
          notes: data.notes,
          holdExpiresAt: data.holdExpiresAt,
        },
      });

      await this.writeLines(tx, booking.id, data.quote);
      return toBooking(booking);
    });
  }

  async findById(id: number): Promise<Booking | null> {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: { lines: { orderBy: { lineDate: 'asc' } } },
    });
    return booking ? toBooking(booking) : null;
  }

  async findByReference(reference: string): Promise<Booking | null> {
    const booking = await this.prisma.booking.findUnique({
      where: { reference },
      include: { lines: { orderBy: { lineDate: 'asc' } } },
    });
    return booking ? toBooking(booking) : null;
  }

  /**
   * Pinned to the primary: this backs the cancel link, and a customer clicking
   * through seconds after booking must not be told their booking does not exist
   * because a replica has not caught up yet.
   */
  async findByCancellationToken(token: string): Promise<Booking | null> {
    const booking = await this.prisma.$primary().booking.findUnique({
      where: { cancellationToken: token },
      include: { lines: { orderBy: { lineDate: 'asc' } } },
    });
    return booking ? toBooking(booking) : null;
  }

  async findDetailedById(id: number): Promise<BookingDetail | null> {
    const booking = await this.prisma.$primary().booking.findUnique({
      where: { id },
      include: {
        lines: { orderBy: { lineDate: 'asc' } },
        room: { select: { name: true } },
        tourDeparture: {
          select: { departureDate: true, tour: { select: { name: true } } },
        },
      },
    });
    if (!booking) {
      return null;
    }

    return {
      booking: toBooking(booking),
      roomName: booking.room?.name ?? null,
      tourName: booking.tourDeparture?.tour.name ?? null,
      departureDate: booking.tourDeparture?.departureDate ?? null,
    };
  }

  async findByRoom(roomId: number, filter: BookingHistoryFilter): Promise<Booking[]> {
    const bookings = await this.prisma.$replica().booking.findMany({
      where: {
        roomId,
        status: filter.status,
        ...(filter.range
          ? { checkIn: { lt: filter.range.to }, checkOut: { gt: filter.range.from } }
          : {}),
      },
      include: { lines: { orderBy: { lineDate: 'asc' } } },
      orderBy: { checkIn: 'desc' },
      skip: filter.skip,
      take: filter.take,
    });
    return bookings.map(toBooking);
  }

  async findByTour(tourId: number, filter: BookingHistoryFilter): Promise<Booking[]> {
    const bookings = await this.prisma.$replica().booking.findMany({
      where: {
        tourDeparture: {
          tourId,
          ...(filter.range
            ? { departureDate: { gte: filter.range.from, lt: filter.range.to } }
            : {}),
        },
        status: filter.status,
      },
      include: { lines: { orderBy: { lineDate: 'asc' } } },
      orderBy: { createdAt: 'desc' },
      skip: filter.skip,
      take: filter.take,
    });
    return bookings.map(toBooking);
  }

  async markConfirmed(id: number, confirmedAt: Date): Promise<Booking | null> {
    // Conditional on PENDING: the row count is the idempotency guard, so two
    // concurrent confirms produce exactly one winner and one set of emails.
    const result = await this.prisma.booking.updateMany({
      where: { id, status: BookingStatus.PENDING },
      data: { status: BookingStatus.CONFIRMED, confirmedAt, holdExpiresAt: null },
    });
    return result.count === 0 ? null : this.findById(id);
  }

  async markCancelled(
    id: number,
    cancelledAt: Date,
    reason: string | null,
  ): Promise<Booking | null> {
    const cancelled = await this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id },
        select: { type: true, seats: true, tourDepartureId: true, notes: true },
      });
      if (!booking) {
        return false;
      }

      // The conditional transition is what makes the seat release exactly-once:
      // a concurrent cancel and expiry sweep can both arrive here, but only one
      // wins the UPDATE, so the seats are given back a single time.
      const released = await tx.booking.updateMany({
        where: { id, status: { in: [...ACTIVE_STATUSES] } },
        data: {
          status: BookingStatus.CANCELLED,
          cancelledAt,
          notes: reason ?? booking.notes,
        },
      });

      if (released.count === 0) {
        return false;
      }

      if (booking.type === BookableType.TOUR && booking.tourDepartureId && booking.seats) {
        await tx.tourDeparture.update({
          where: { id: booking.tourDepartureId },
          data: { bookedSeats: { decrement: booking.seats } },
        });
      }
      // ROOM needs nothing: the status change drops the row out of the
      // bookings_room_no_overlap partial index, freeing the dates atomically.

      return true;
    });

    return cancelled ? this.findById(id) : null;
  }

  /**
   * Releases one booking's hold, driven by the delayed message that names it.
   * One atomic statement, so statuses and seat counters can never diverge, and
   * the status guard means the message is only a prompt to look, never
   * permission to expire: a booking confirmed a second before the message
   * arrives matches zero rows here, as does a redelivery.
   */
  async expireHold(bookingId: number, now: Date): Promise<boolean> {
    const result = await this.prisma.$primary().$queryRaw<Array<{ expired: number }>>`
      WITH expired AS (
        UPDATE "bookings"
        SET "status" = 'EXPIRED', "updated_at" = NOW()
        WHERE "id" = ${bookingId}
          AND "status" = 'PENDING'
          AND "hold_expires_at" IS NOT NULL
          AND "hold_expires_at" <= ${now}
        RETURNING "id", "type", "tour_departure_id", "seats"
      ), released AS (
        SELECT "tour_departure_id" AS id, SUM("seats")::int AS seats
        FROM expired
        WHERE "type" = 'TOUR' AND "tour_departure_id" IS NOT NULL
        GROUP BY "tour_departure_id"
      ), returned AS (
        UPDATE "tour_departures" d
        SET "booked_seats" = d."booked_seats" - r.seats,
            "updated_at" = NOW()
        FROM released r
        WHERE d."id" = r.id
        RETURNING d."id"
      )
      SELECT (SELECT COUNT(*)::int FROM expired) AS "expired"
    `;
    return (result[0]?.expired ?? 0) > 0;
  }

  async closeElapsedDepartures(today: Date): Promise<number> {
    const result = await this.prisma.$primary().tourDeparture.updateMany({
      where: { status: 'OPEN', departureDate: { lt: today } },
      data: { status: 'CLOSED' },
    });
    return result.count;
  }

  /**
   * A room stay is over once its checkout day has arrived; a tour is over the
   * day after it departs. Both are compared against UTC midnight, matching the
   * @db.Date columns.
   */
  async completeElapsedBookings(today: Date): Promise<number> {
    const result = await this.prisma.$primary().$executeRaw`
      UPDATE "bookings" b
      SET "status" = 'COMPLETED', "completed_at" = NOW(), "updated_at" = NOW()
      WHERE b."status" = 'CONFIRMED'
        AND (
          (b."type" = 'ROOM' AND b."check_out" <= ${today}::date)
          OR (
            b."type" = 'TOUR'
            AND EXISTS (
              SELECT 1 FROM "tour_departures" d
              WHERE d."id" = b."tour_departure_id"
                AND d."departure_date" < ${today}::date
            )
          )
        )
    `;
    return result;
  }
}
