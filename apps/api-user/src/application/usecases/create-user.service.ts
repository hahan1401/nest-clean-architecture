import { Injectable } from '@nestjs/common';
import { ConflictError } from '@app/common';
import { User } from '@app/database';
import { UserRepository } from '../../domain/repositories/user.repository';
import { CreateUserUseCase } from '../../domain/usecases/create-user.usecase';

@Injectable()
export class CreateUserService implements CreateUserUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(data: { name: string; email: string; password: string }): Promise<User> {
    const existingUser = await this.userRepository.findByEmail(data.email);
    if (existingUser) {
      throw new ConflictError('User with this email already exists');
    }
    return this.userRepository.create(data);
  }
}
