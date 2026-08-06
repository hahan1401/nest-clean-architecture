import { Injectable } from '@nestjs/common';
import { User } from '@app/database';
import { UserRepository } from '../../domain/repositories/user.repository';
import { GetUsersUseCase } from '../../domain/usecases/get-users.usecase';

@Injectable()
export class GetUsersService implements GetUsersUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(): Promise<User[]> {
    return this.userRepository.findAll();
  }
}
