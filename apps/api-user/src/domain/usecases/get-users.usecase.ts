import { User } from '@app/database';

export interface GetUsersUseCase {
  execute(): Promise<User[]>;
}
