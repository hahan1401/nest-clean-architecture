import { Injectable } from '@nestjs/common';
import { User } from '@app/database';
import { UserRepository } from '../../domain/repositories/user.repository';

@Injectable()
export class CreateUserService {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(data: { name: string; email: string; password: string }): Promise<User> {
    const existingUser = await this.userRepository.findByEmail(data.email);
    if (existingUser) {
      throw new Error('User with this email already exists');
    }
    return this.userRepository.create(data);
  }
}
