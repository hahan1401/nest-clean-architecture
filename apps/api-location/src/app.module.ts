import { AllExceptionsRpcFilter, createPinoHttpConfig, LoggingInterceptor } from '@app/common';
import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { GeocodingModule } from './presentation/modules/geocoding.module';
import { join } from 'path';
import { LoggerModule } from 'nestjs-pino';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        join(process.cwd(), '.env.local'),
        join(process.cwd(), 'apps/api-location/.env.local'),
      ],
    }),
    LoggerModule.forRoot({
      pinoHttp: createPinoHttpConfig('API-LOCATION'),
    }),

    GeocodingModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsRpcFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule {}
