import { Injectable } from '@nestjs/common';
import { UserWithDistance } from '@app/database';
import { UserRepository } from '../../domain/repositories/user.repository';
import { FindNearbyUsersUseCase } from '../../domain/usecases/find-nearby-users.usecase';

@Injectable()
export class FindNearbyUsersService implements FindNearbyUsersUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(userId: number, radiusKm?: number): Promise<UserWithDistance[]> {
    return this.userRepository.findNearby(userId, radiusKm);
  }
}
