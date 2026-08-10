export class User {
  id: number;
  name: string;
  email: string;
  password: string;
  latitude?: number | null;
  longitude?: number | null;
  locationName?: string | null;
  locationUpdatedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;

  constructor(partial: Partial<User>) {
    Object.assign(this, partial);
  }
}

export class UserWithDistance extends User {
  distanceKm: number;

  constructor(partial: Partial<UserWithDistance>) {
    super(partial);
    Object.assign(this, partial);
  }
}
