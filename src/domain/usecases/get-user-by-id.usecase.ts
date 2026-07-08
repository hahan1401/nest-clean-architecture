import { User } from '../entities/user.entity';

export interface GetUserByIdUseCase {
  execute(id: string): Promise<User | null>;
}
