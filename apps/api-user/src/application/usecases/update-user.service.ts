import { User } from '@app/database';
import { Injectable } from '@nestjs/common';
import { NotFoundError } from '@app/common';
import { UserRepository } from '../../domain/repositories/user.repository';
import { UpdateUserUseCase } from '../../domain/usecases/update-user.usecase';

@Injectable()
export class UpdateUserService implements UpdateUserUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(id: string, data: Partial<User>): Promise<User> {
    const user = await this.userRepository.update(id, data);
    if (!user) {
      throw new NotFoundError(`User with id ${id} not found`);
    }
    return user;
  }
}
