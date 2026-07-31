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
  Inject,
  Req,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import type { Request } from 'express';
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
  create(@Req() req: Request, @Body() dto: CreateUserDto) {
    return lastValueFrom(
      this.userClient.send(USER_PATTERNS.CREATE_USER, { ...dto, requestId: req['requestId'] }),
    );
  }

  @Get()
  findAll() {
    return lastValueFrom(this.userClient.send(USER_PATTERNS.GET_USERS, {}));
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return lastValueFrom(this.userClient.send(USER_PATTERNS.GET_USER_BY_ID, id));
  }

  @Put(':id')
  update(@Req() req: Request, @Param('id') id: string, @Body() updateData: UpdateUserDto) {
    return lastValueFrom(
      this.userClient.send(USER_PATTERNS.UPDATE_USER, {
        id,
        updateData,
        requestId: req['requestId'],
      }),
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return lastValueFrom(this.userClient.send(USER_PATTERNS.DELETE_USER, id));
  }

  @Patch(':id/location')
  updateLocation(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateLocationDto) {
    return lastValueFrom(
      this.userClient.send(USER_PATTERNS.UPDATE_LOCATION, {
        id,
        latitude: dto.latitude,
        longitude: dto.longitude,
        requestId: req['requestId'],
      }),
    );
  }

  @Get(':id/nearby')
  findNearby(
    @Req() req: Request,
    @Param('id') id: string,
    @Query('radius', new DefaultValuePipe(10), ParseIntPipe) radius: number,
  ) {
    return lastValueFrom(
      this.userClient.send(USER_PATTERNS.FIND_NEARBY_USERS, {
        id,
        radius,
        requestId: req['requestId'],
      }),
    );
  }
}
