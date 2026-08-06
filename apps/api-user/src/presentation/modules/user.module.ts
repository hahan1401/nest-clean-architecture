import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '@app/database';
import { GEOCODING_SERVICE } from '@app/common';
import { UserRepository } from '../../domain/repositories/user.repository';
import { UserTypeOrmRepository } from '../../infrastructure/repositories/user-typeorm.repository';
import { GeocodingClientPort } from '../../domain/ports/geocoding-client.port';
import { GeocodingClientService } from '../../infrastructure/services/geocoding-client.service';
import { CreateUserService } from '../../application/usecases/create-user.service';
import { GetUsersService } from '../../application/usecases/get-users.service';
import { GetUserByIdService } from '../../application/usecases/get-user-by-id.service';
import { UpdateUserService } from '../../application/usecases/update-user.service';
import { DeleteUserService } from '../../application/usecases/delete-user.service';
import { UpdateLocationService } from '../../application/usecases/update-location.service';
import { FindNearbyUsersService } from '../../application/usecases/find-nearby-users.service';
import { UserController } from '../controllers/user.controller';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    ClientsModule.registerAsync([
      {
        name: GEOCODING_SERVICE,
        useFactory: (configService: ConfigService) => ({
          transport: Transport.TCP,
          options: {
            host: configService.getOrThrow<string>('HOST_NAME'),
            port: configService.getOrThrow<number>('LOCATION_SERVICE_PORT'),
          },
        }),
        inject: [ConfigService],
      },
    ]),
  ],
  controllers: [UserController],
  providers: [
    { provide: UserRepository, useClass: UserTypeOrmRepository },
    { provide: GeocodingClientPort, useClass: GeocodingClientService },
    CreateUserService,
    GetUsersService,
    GetUserByIdService,
    UpdateUserService,
    DeleteUserService,
    UpdateLocationService,
    FindNearbyUsersService,
  ],
})
export class UserModule {}
