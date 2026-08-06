import { User } from '@app/database';

export interface GetUserByIdUseCase {
  execute(id: string): Promise<User | null>;
}
