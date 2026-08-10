import { UserWithDistance } from '@app/database';

export interface FindNearbyUsersUseCase {
  execute: (id: number, radiusKm?: number) => Promise<UserWithDistance[]>;
}
