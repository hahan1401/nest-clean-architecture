import { User } from '@app/database';

export interface UpdateUserUseCase {
  execute(id: string, data: Partial<User>): Promise<User>;
}
