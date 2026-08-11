import { User, UserWithDistance } from '@app/database';

export class UserResponseDto {
  id: number;
  name: string;
  email: string;
  locationName: string | null;
  /** ISO 8601 instants, the one temporal shape this API speaks. */
  createdAt: string;
  updatedAt: string;

  constructor(user: User) {
    this.id = user.id;
    this.name = user.name;
    this.email = user.email;
    this.locationName = user.locationName ?? null;
    this.createdAt = user.createdAt.toISOString();
    this.updatedAt = user.updatedAt.toISOString();
  }
}

export class UserWithDistanceResponseDto extends UserResponseDto {
  distanceKm: number;

  constructor(user: UserWithDistance) {
    super(user);
    this.distanceKm = user.distanceKm;
  }
}
