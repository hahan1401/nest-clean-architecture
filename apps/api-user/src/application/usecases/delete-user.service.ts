import { Injectable } from '@nestjs/common';
import { NotFoundError } from '@app/common';
import { UserRepository } from '../../domain/repositories/user.repository';
import { DeleteUserUseCase } from '../../domain/usecases/delete-user.usecase';

@Injectable()
export class DeleteUserService implements DeleteUserUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(id: number): Promise<void> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundError(`User with id ${id} not found`);
    }
    await this.userRepository.delete(id);
  }
}
