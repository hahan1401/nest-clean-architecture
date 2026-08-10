import { User } from '@app/database';

export interface UpdateLocationUseCase {
  execute(userId: number, latitude: number, longitude: number): Promise<User>;
}
