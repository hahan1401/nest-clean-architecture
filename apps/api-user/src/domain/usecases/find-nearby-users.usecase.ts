import { UserWithDistance } from '@app/database';

export interface FindNearbyUsersUseCase {
  execute: (id: string, radiusKm?: number) => Promise<UserWithDistance[]>;
}
