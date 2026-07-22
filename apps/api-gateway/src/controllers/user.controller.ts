import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  DefaultValuePipe,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  HttpException,
  Inject,
  Req,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';
import {
  USER_SERVICE,
  USER_PATTERNS,
  CreateUserDto,
  UpdateUserDto,
  UpdateLocationDto,
} from '@app/common';

@Controller('users')
export class UserController {
  constructor(@Inject(USER_SERVICE) private readonly userClient: ClientProxy) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateUserDto) {
    return lastValueFrom(this.userClient.send(USER_PATTERNS.CREATE_USER, dto)).catch((err) => {
      throw new HttpException(err?.message ?? 'Internal error', err?.status ?? 500);
    });
  }

  @Get()
  async findAll() {
    return lastValueFrom(this.userClient.send(USER_PATTERNS.GET_USERS, {})).catch((err) => {
      throw new HttpException(err?.message ?? 'Internal error', err?.status ?? 500);
    });
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return lastValueFrom(this.userClient.send(USER_PATTERNS.GET_USER_BY_ID, id)).catch((err) => {
      throw new HttpException(err?.message ?? 'Internal error', err?.status ?? 500);
    });
  }

  @Put(':id')
  async update(@Req() req: Request, @Param('id') id: string, @Body() updateData: UpdateUserDto) {
    return lastValueFrom(
      this.userClient.send(USER_PATTERNS.UPDATE_USER, {
        id,
        updateData,
        requestId: req['requestId'],
      }),
    ).catch((err) => {
      throw new HttpException(err?.message ?? 'Internal error', err?.status ?? 500);
    });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    return lastValueFrom(this.userClient.send(USER_PATTERNS.DELETE_USER, id)).catch((err) => {
      throw new HttpException(err?.message ?? 'Internal error', err?.status ?? 500);
    });
  }

  @Patch(':id/location')
  async updateLocation(@Param('id') id: string, @Body() dto: UpdateLocationDto) {
    return lastValueFrom(
      this.userClient.send(USER_PATTERNS.UPDATE_LOCATION, {
        id,
        latitude: dto.latitude,
        longitude: dto.longitude,
      }),
    ).catch((err) => {
      throw new HttpException(err?.message ?? 'Internal error', err?.status ?? 500);
    });
  }

  @Get(':id/nearby')
  async findNearby(
    @Param('id') id: string,
    @Query('radius', new DefaultValuePipe(10), ParseIntPipe) radius: number,
  ) {
    return lastValueFrom(
      this.userClient.send(USER_PATTERNS.FIND_NEARBY_USERS, { id, radius }),
    ).catch((err) => {
      throw new HttpException(err?.message ?? 'Internal error', err?.status ?? 500);
    });
  }
}
