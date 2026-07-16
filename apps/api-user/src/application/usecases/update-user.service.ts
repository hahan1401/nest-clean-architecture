import { Injectable, NotFoundException } from '@nestjs/common';
import { User } from '@app/database';
import { UserRepository } from '../../domain/repositories/user.repository';

@Injectable()
export class UpdateUserService {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(id: string, data: Partial<User>): Promise<User> {
    const user = await this.userRepository.update(id, data);
    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }
    return user;
  }
}
