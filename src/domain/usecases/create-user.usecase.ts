import { User } from '../entities/user.entity';

export interface CreateUserUseCase {
  execute(data: { name: string; email: string; password: string }): Promise<User>;
}
