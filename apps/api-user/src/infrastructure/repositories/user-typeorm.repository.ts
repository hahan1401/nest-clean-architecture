import { Injectable } from '@nestjs/common';
import { DataSource, DeepPartial, Repository } from 'typeorm';
import { User, UserOrmEntity, UserWithDistance } from '@app/database';
import { UserRepository } from '../../domain/repositories/user.repository';

type NearbyRow = {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
  locationName: string | null;
  distance_km: number;
};

@Injectable()
export class UserTypeOrmRepository extends UserRepository {
  private readonly repo: Repository<UserOrmEntity>;

  constructor(private readonly dataSource: DataSource) {
    super();
    this.repo = dataSource.getRepository(UserOrmEntity);
  }

  private toDomain(orm: UserOrmEntity): User {
    return new User(orm);
  }

  async findAll(): Promise<User[]> {
    const rows = await this.repo.find();
    return rows.map((row) => this.toDomain(row));
  }

  async findById(id: string): Promise<User | null> {
    const row = await this.repo.findOne({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = await this.repo.findOne({ where: { email } });
    return row ? this.toDomain(row) : null;
  }

  async create(data: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    const entity = this.repo.create(data as DeepPartial<UserOrmEntity>);
    const saved = await this.repo.save(entity);
    return this.toDomain(saved);
  }

  async update(id: string, data: Partial<User>): Promise<User> {
    const row = await this.repo.findOneOrFail({ where: { id } });
    Object.assign(row, data);
    const saved = await this.repo.save(row);
    return this.toDomain(saved);
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete({ id });
  }

  async updateLocation(
    id: string,
    latitude: number,
    longitude: number,
    locationName: string | null,
  ): Promise<User> {
    const row = await this.repo.findOneOrFail({ where: { id } });
    Object.assign(row, { latitude, longitude, locationName, locationUpdatedAt: new Date() });
    const saved = await this.repo.save(row);
    return this.toDomain(saved);
  }

  async findNearby(userId: string, radiusKm: number): Promise<UserWithDistance[]> {
    const user = await this.findById(userId);
    if (!user) {
      throw new Error(`User with id ${userId} not found`);
    }

    // $1 = latitude, $2 = longitude, $3 = userId, $4 = radiusKm (Haversine great-circle distance).
    const rows = await this.dataSource.query<NearbyRow[]>(
      `
      SELECT * FROM (
        SELECT
          id,
          name,
          email,
          created_at AS "createdAt",
          updated_at AS "updatedAt",
          location_name AS "locationName",
          (6371 * acos(
            LEAST(1, GREATEST(-1,
              cos(radians($1)) * cos(radians(latitude)) *
              cos(radians(longitude) - radians($2)) +
              sin(radians($1)) * sin(radians(latitude))
            ))
          )) AS distance_km
        FROM users
        WHERE id != $3
          AND latitude IS NOT NULL
          AND longitude IS NOT NULL
      ) AS sub
      WHERE distance_km < $4
      ORDER BY distance_km ASC
      `,
      [user.latitude, user.longitude, userId, radiusKm],
    );

    return rows.map((row) => new UserWithDistance({ ...row, distanceKm: Number(row.distance_km) }));
  }
}
