import { User } from '@app/database';

export interface UpdateUserUseCase {
  execute(id: number, data: Partial<User>): Promise<User>;
}
