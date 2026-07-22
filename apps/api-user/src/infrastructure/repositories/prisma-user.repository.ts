import { Injectable } from '@nestjs/common';
import { User, UserWithDistance, PrismaService } from '@app/database';
import { UserRepository } from '../../domain/repositories/user.repository';

@Injectable()
export class PrismaUserRepository extends UserRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findAll(): Promise<User[]> {
    const users = await this.prisma.user.findMany();
    return users.map((user) => new User(user));
  }

  async findById(id: string): Promise<User | null> {
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

  async update(id: string, data: Partial<User>): Promise<User> {
    const user = await this.prisma.user.update({ where: { id }, data });
    return new User(user);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.user.delete({ where: { id } });
  }

  async updateLocation(
    id: string,
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

  async findNearby(userId: string, radiusKm: number): Promise<UserWithDistance[]> {
    const user = await this.findById(userId);
    if (!user) {
      throw new Error(`User with id ${userId} not found`);
    }
    const rows = await this.prisma.$queryRaw<Array<User & { distance_km: number }>>`
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
      ) AS sub
      WHERE distance_km < ${radiusKm}
      ORDER BY distance_km ASC
    `;

    return rows.map((row) => new UserWithDistance({ ...row, distanceKm: row.distance_km }));
  }
}
