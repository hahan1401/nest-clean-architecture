import { AllExceptionsRpcFilter, createPinoHttpConfig, LoggingInterceptor } from '@app/common';
import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { join } from 'path';
import { ApiPaymentModule } from './presentation/modules/api-payment.module';
import { LoggerModule } from 'nestjs-pino';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        join(process.cwd(), '.env.local'),
        join(process.cwd(), 'apps/api-payment/.env.local'),
      ],
    }),
    LoggerModule.forRoot({
      pinoHttp: createPinoHttpConfig('API-PAYMENT'),
    }),
    ApiPaymentModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsRpcFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule {}
