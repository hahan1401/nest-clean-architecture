import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload, RpcException } from '@nestjs/microservices';
import {
  USER_PATTERNS,
  UserResponseDto,
  UserWithDistanceResponseDto,
  CreateUserDto,
  UpdateUserDto,
} from '@app/common';
import { CreateUserService } from '../../application/usecases/create-user.service';
import { GetUsersService } from '../../application/usecases/get-users.service';
import { GetUserByIdService } from '../../application/usecases/get-user-by-id.service';
import { UpdateUserService } from '../../application/usecases/update-user.service';
import { DeleteUserService } from '../../application/usecases/delete-user.service';
import { UpdateLocationService } from '../../application/usecases/update-location.service';
import { FindNearbyUsersService } from '../../application/usecases/find-nearby-users.service';

@Controller()
export class UserController {
  private readonly logger = new Logger(UserController.name);

  constructor(
    private readonly createUserService: CreateUserService,
    private readonly getUsersService: GetUsersService,
    private readonly getUserByIdService: GetUserByIdService,
    private readonly updateUserService: UpdateUserService,
    private readonly deleteUserService: DeleteUserService,
    private readonly updateLocationService: UpdateLocationService,
    private readonly findNearbyUsersService: FindNearbyUsersService,
  ) {}

  @MessagePattern(USER_PATTERNS.CREATE_USER)
  async create(@Payload() data: CreateUserDto) {
    try {
      const user = await this.createUserService.execute(data);
      return new UserResponseDto(user);
    } catch (err: any) {
      throw new RpcException({
        status: err.status ?? 400,
        message: err.message,
      });
    }
  }

  @MessagePattern(USER_PATTERNS.GET_USERS)
  async findAll() {
    try {
      const users = await this.getUsersService.execute();
      return users.map((u) => new UserResponseDto(u));
    } catch (err: any) {
      throw new RpcException({
        status: err.status ?? 500,
        message: err.message,
      });
    }
  }

  @MessagePattern(USER_PATTERNS.GET_USER_BY_ID)
  async findOne(@Payload() id: string) {
    try {
      const user = await this.getUserByIdService.execute(id);
      return new UserResponseDto(user);
    } catch (err: any) {
      throw new RpcException({
        status: err.status ?? 404,
        message: err.message,
      });
    }
  }

  @MessagePattern(USER_PATTERNS.UPDATE_USER)
  async update(
    @Payload()
    data: {
      id: string;
      updateData: UpdateUserDto;
      requestId?: string;
    },
  ) {
    try {
      this.logger.log(`Updating user ${JSON.stringify(data)}`);
      const user = await this.updateUserService.execute(data.id, data.updateData);
      return new UserResponseDto(user);
    } catch (err: any) {
      this.logger.error(`Failed to update user: ${err.message}`, `RequestId: ${data.requestId}`);
      throw new RpcException({
        status: err.status ?? 404,
        message: err.message,
      });
    }
  }

  @MessagePattern(USER_PATTERNS.DELETE_USER)
  async remove(@Payload() id: string) {
    try {
      await this.deleteUserService.execute(id);
      return { success: true };
    } catch (err: any) {
      throw new RpcException({
        status: err.status ?? 404,
        message: err.message,
      });
    }
  }

  @MessagePattern(USER_PATTERNS.UPDATE_LOCATION)
  async updateLocation(@Payload() data: { id: string; latitude: number; longitude: number }) {
    try {
      const user = await this.updateLocationService.execute(data.id, data.latitude, data.longitude);
      return new UserResponseDto(user);
    } catch (err: any) {
      throw new RpcException({
        status: err.status ?? 404,
        message: err.message,
      });
    }
  }

  @MessagePattern(USER_PATTERNS.FIND_NEARBY_USERS)
  async findNearby(@Payload() data: { id: string; radius: number }) {
    try {
      const users = await this.findNearbyUsersService.execute(data.id, data.radius);
      return users.map((u) => new UserWithDistanceResponseDto(u));
    } catch (err: any) {
      throw new RpcException({
        status: err.status ?? 404,
        message: err.message,
      });
    }
  }
}
