import { Injectable } from '@nestjs/common';
import { NotFoundError } from '@app/common';
import { User } from '@app/database';
import { UserRepository } from '../../domain/repositories/user.repository';
import { GetUserByIdUseCase } from '../../domain/usecases/get-user-by-id.usecase';

@Injectable()
export class GetUserByIdService implements GetUserByIdUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(id: string): Promise<User> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundError(`User with id ${id} not found`);
    }
    return user;
  }
}
