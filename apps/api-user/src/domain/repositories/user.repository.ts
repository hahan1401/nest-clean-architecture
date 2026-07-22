import { User, UserWithDistance } from '@app/database';

export abstract class UserRepository {
  abstract findAll(): Promise<User[]>;
  abstract findById(id: string): Promise<User | null>;
  abstract findByEmail(email: string): Promise<User | null>;
  abstract create(data: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User>;
  abstract update(id: string, data: Partial<User>): Promise<User>;
  abstract delete(id: string): Promise<void>;
  abstract updateLocation(
    id: string,
    latitude: number,
    longitude: number,
    locationName: string | null,
  ): Promise<User>;
  abstract findNearby(userId: string, radiusKm: number): Promise<UserWithDistance[]>;
}
