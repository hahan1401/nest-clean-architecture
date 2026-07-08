import { Module } from '@nestjs/common';
import { UserController } from '../controllers/user.controller';
import { UserRepository } from '../../domain/repositories/user.repository';
import { PrismaUserRepository } from '../../infrastructure/repositories/prisma-user.repository';
import { CreateUserService } from '../../application/usecases/create-user.service';
import { GetUsersService } from '../../application/usecases/get-users.service';
import { GetUserByIdService } from '../../application/usecases/get-user-by-id.service';
import { UpdateUserService } from '../../application/usecases/update-user.service';
import { DeleteUserService } from '../../application/usecases/delete-user.service';

@Module({
  controllers: [UserController],
  providers: [
    {
      provide: UserRepository,
      useClass: PrismaUserRepository,
    },
    CreateUserService,
    GetUsersService,
    GetUserByIdService,
    UpdateUserService,
    DeleteUserService,
  ],
})
export class UserModule {}
