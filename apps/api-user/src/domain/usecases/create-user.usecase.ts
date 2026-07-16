import { User } from '@app/database';

export interface CreateUserUseCase {
  execute(data: { name: string; email: string; password: string }): Promise<User>;
}
