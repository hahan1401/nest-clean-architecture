import {
  AvailableDeparture,
  DepartureStatus,
  PRISMA_SERVICE,
  TourDeparture,
  type ExtendedPrismaClient,
} from '@app/database';
import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DateRange } from '../../domain/models/date-range';
import {
  CreateTourDepartureData,
  TourDepartureRepository,
} from '../../domain/repositories/tour-departure.repository';

/** Shape of the raw availability projection; typed so the rows are not `any`. */
interface AvailableDepartureRow {
  id: number;
  tour_id: number;
  tour_name: string;
  departure_date: Date;
  capacity: number;
  booked_seats: number;
  remaining_seats: number;
  price_per_person: number;
  price_override: number | null;
  status: DepartureStatus;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class PrismaTourDepartureRepository extends TourDepartureRepository {
  constructor(@Inject(PRISMA_SERVICE) private readonly prisma: ExtendedPrismaClient) {
    super();
  }

  async create(data: CreateTourDepartureData): Promise<TourDeparture> {
    const departure = await this.prisma.tourDeparture.create({ data });
    return new TourDeparture(departure);
  }

  async findById(id: number): Promise<TourDeparture | null> {
    const departure = await this.prisma.tourDeparture.findUnique({ where: { id } });
    return departure ? new TourDeparture(departure) : null;
  }

  async findByTourAndDate(tourId: number, departureDate: Date): Promise<TourDeparture | null> {
    const departure = await this.prisma.tourDeparture.findUnique({
      where: { tourId_departureDate: { tourId, departureDate } },
    });
    return departure ? new TourDeparture(departure) : null;
  }

  async findByTour(tourId: number, range?: DateRange): Promise<TourDeparture[]> {
    const departures = await this.prisma.tourDeparture.findMany({
      where: {
        tourId,
        departureDate: range ? { gte: range.from, lt: range.to } : undefined,
      },
      orderBy: { departureDate: 'asc' },
    });
    return departures.map((departure) => new TourDeparture(departure));
  }

  /**
   * Raw SQL is unavoidable here: `capacity - booked_seats >= $n` is arithmetic
   * between two columns, which the Prisma filter API cannot express.
   *
   * $queryRaw is NOT auto-routed by the read-replicas extension, so the role is
   * explicit. This is the browse path, which tolerates lag - the authoritative
   * seat check is the conditional UPDATE at booking time.
   */
  async findAvailable(
    range: DateRange,
    seats: number,
    tourId?: number,
  ): Promise<AvailableDeparture[]> {
    const tourFilter = tourId ? Prisma.sql`AND d."tour_id" = ${tourId}` : Prisma.empty;

    const rows = await this.prisma.$replica().$queryRaw<AvailableDepartureRow[]>`
      SELECT
        d."id",
        d."tour_id",
        t."name" AS "tour_name",
        d."departure_date",
        d."capacity",
        d."booked_seats",
        (d."capacity" - d."booked_seats") AS "remaining_seats",
        COALESCE(d."price_override", t."base_price_per_person") AS "price_per_person",
        d."price_override",
        d."status",
        d."created_at",
        d."updated_at"
      FROM "tour_departures" d
      JOIN "tours" t ON t."id" = d."tour_id"
      WHERE d."status" = 'OPEN'
        AND t."is_active"
        AND d."departure_date" >= ${range.from}
        AND d."departure_date" < ${range.to}
        AND (d."capacity" - d."booked_seats") >= ${seats}
        ${tourFilter}
      ORDER BY d."departure_date" ASC
    `;

    return rows.map(
      (row) =>
        new AvailableDeparture({
          id: row.id,
          tourId: row.tour_id,
          tourName: row.tour_name,
          departureDate: row.departure_date,
          capacity: row.capacity,
          bookedSeats: row.booked_seats,
          remainingSeats: row.remaining_seats,
          pricePerPerson: row.price_per_person,
          priceOverride: row.price_override,
          status: row.status,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }),
    );
  }
}
