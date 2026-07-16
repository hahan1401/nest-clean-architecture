import { Injectable } from '@nestjs/common';
import { UserWithDistance } from '@app/database';
import { UserRepository } from '../../domain/repositories/user.repository';

@Injectable()
export class FindNearbyUsersService {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(userId: string, radiusKm: number): Promise<UserWithDistance[]> {
    return this.userRepository.findNearby(userId, radiusKm);
  }
}
