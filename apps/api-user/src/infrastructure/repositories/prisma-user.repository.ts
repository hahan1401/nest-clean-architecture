import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { User, UserWithDistance, PRISMA_SERVICE, type ExtendedPrismaClient } from '@app/database';
import { UserRepository } from '../../domain/repositories/user.repository';
import { boundingBoxFor } from '../geo/bounding-box';

@Injectable()
export class PrismaUserRepository extends UserRepository {
  constructor(@Inject(PRISMA_SERVICE) private readonly prisma: ExtendedPrismaClient) {
    super();
  }

  async findAll(): Promise<User[]> {
    const users = await this.prisma.user.findMany();
    return users.map((user) => new User(user));
  }

  async findById(id: number): Promise<User | null> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    return user ? new User(user) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    return user ? new User(user) : null;
  }

  async create(data: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    const user = await this.prisma.user.create({ data });
    return new User(user);
  }

  async update(id: number, data: Partial<User>): Promise<User> {
    const user = await this.prisma.user.update({ where: { id }, data });
    return new User(user);
  }

  async delete(id: number): Promise<void> {
    await this.prisma.user.delete({ where: { id } });
  }

  async updateLocation(
    id: number,
    latitude: number,
    longitude: number,
    locationName: string | null,
  ): Promise<User> {
    const user = await this.prisma.user.update({
      where: { id },
      data: { latitude, longitude, locationName, locationUpdatedAt: new Date() },
    });
    return new User(user);
  }

  async findNearby(userId: number, radiusKm: number): Promise<UserWithDistance[]> {
    // Read the caller's own coordinates from the primary: this frequently runs right
    // after updateLocation, and replication lag would search from a stale origin.
    const row = await this.prisma.$primary().user.findUnique({ where: { id: userId } });
    if (!row) {
      throw new Error(`User with id ${userId} not found`);
    }
    const user = new User(row);

    // Nothing to search from, and the box maths would produce NaN.
    if (
      user.latitude == null ||
      user.longitude == null ||
      !Number.isFinite(radiusKm) ||
      radiusKm <= 0
    ) {
      return [];
    }

    // Prefilter on a lat/lng rectangle so the composite index on
    // (latitude, longitude) eliminates almost every row before the trigonometry
    // runs. Haversine itself is not indexable, so without this the planner has no
    // choice but a full scan plus an acos() per row.
    const box = boundingBoxFor(user.latitude, user.longitude, radiusKm);

    const longitudeFilter = box.wrapsAntimeridian
      ? Prisma.sql`(longitude >= ${box.minLng} OR longitude <= ${box.maxLng})`
      : Prisma.sql`longitude BETWEEN ${box.minLng} AND ${box.maxLng}`;

    // The scan itself is the expensive part and tolerates lag, so it goes to a replica.
    const rows = await this.prisma.$replica().$queryRaw<Array<User & { distance_km: number }>>`
      SELECT * FROM (
        SELECT
          id,
          name,
          email,
          created_at as "createdAt",
          updated_at as "updatedAt",
          location_name as "locationName",
          (6371 * acos(
            LEAST(1, GREATEST(-1,
              cos(radians(${user.latitude})) * cos(radians(latitude)) *
              cos(radians(longitude) - radians(${user.longitude})) +
              sin(radians(${user.latitude})) * sin(radians(latitude))
            ))
          )) AS distance_km
        FROM users
        WHERE id != ${userId}
          AND latitude IS NOT NULL
          AND longitude IS NOT NULL
          AND latitude BETWEEN ${box.minLat} AND ${box.maxLat}
          AND ${longitudeFilter}
      ) AS sub
      WHERE distance_km < ${radiusKm}
      ORDER BY distance_km ASC
    `;

    return rows.map((row) => new UserWithDistance({ ...row, distanceKm: row.distance_km }));
  }
}
