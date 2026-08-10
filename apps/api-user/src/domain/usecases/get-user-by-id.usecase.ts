import { User } from '@app/database';

export interface GetUserByIdUseCase {
  execute(id: number): Promise<User | null>;
}
