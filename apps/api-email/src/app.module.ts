import { AllExceptionsRpcFilter, createPinoHttpConfig, LoggingInterceptor } from '@app/common';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { join } from 'path';
import { ApiEmailModule } from './presentation/modules/api-email.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [join(process.cwd(), '.env.local'), join(process.cwd(), 'apps/api-email/.env.local')],
    }),
    LoggerModule.forRoot({
      pinoHttp: createPinoHttpConfig('API-EMAIL'),
    }),
    ApiEmailModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsRpcFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule {}
