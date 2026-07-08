import { User } from '../entities/user.entity';

export interface GetUsersUseCase {
  execute(): Promise<User[]>;
}
