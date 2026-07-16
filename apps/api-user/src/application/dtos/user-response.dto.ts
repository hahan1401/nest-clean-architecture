import { User, UserWithDistance } from "@app/database";

export class UserResponseDto {
  id: string;
  name: string;
  email: string;
  locationName: string | null;
  createdAt: Date;
  updatedAt: Date;

  constructor (user: User) {
    this.id = user.id;
    this.name = user.name;
    this.email = user.email;
    this.locationName = user.locationName ?? null;
    this.createdAt = user.createdAt;
    this.updatedAt = user.updatedAt;
  }
}

export class UserWithDistanceResponseDto extends UserResponseDto {
  distanceKm: number;

  constructor(user: UserWithDistance) {
    super(user);
    this.distanceKm = user.distanceKm;
  }
}
