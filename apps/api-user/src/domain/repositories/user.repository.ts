import { User, UserWithDistance } from '@app/database';

export abstract class UserRepository {
  abstract findAll(): Promise<User[]>;
  abstract findById(id: number): Promise<User | null>;
  abstract findByEmail(email: string): Promise<User | null>;
  abstract create(data: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User>;
  abstract update(id: number, data: Partial<User>): Promise<User>;
  abstract delete(id: number): Promise<void>;
  abstract updateLocation(
    id: number,
    latitude: number,
    longitude: number,
    locationName: string | null,
  ): Promise<User>;
  abstract findNearby(userId: number, radiusKm?: number): Promise<UserWithDistance[]>;
}
