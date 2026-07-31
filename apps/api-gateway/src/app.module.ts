import { CHATBOT_SERVICE, PAYMENT_SERVICE, USER_SERVICE } from '@app/common';
import { AllExceptionsHttpFilter, createPinoHttpConfig, LoggingInterceptor } from '@app/common';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { CorrelationRequestIdMiddleware } from 'libs/middlewares/correlationRequestId.middleware';
import { LoggerModule } from 'nestjs-pino';
import { join } from 'path';
import { PaymentController } from './controllers/payment.controller';
import { UserController } from './controllers/user.controller';
import { ChatbotController } from './controllers/chatbot.controller';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        join(process.cwd(), '.env.local'),
        join(process.cwd(), 'apps/api-gateway/.env.local'),
      ],
    }),
    LoggerModule.forRoot({
      pinoHttp: createPinoHttpConfig('API-GATEWAY'),
    }),

    ClientsModule.register([
      {
        name: USER_SERVICE,
        transport: Transport.TCP,
        options: {
          host: process.env.USER_SERVICE_HOST || 'localhost',
          port: parseInt(process.env.USER_SERVICE_PORT || '3001'),
        },
      },
    ]),
    ClientsModule.register([
      {
        name: PAYMENT_SERVICE,
        transport: Transport.TCP,
        options: {
          host: process.env.PAYMENT_SERVICE_HOST || 'localhost',
          port: parseInt(process.env.PAYMENT_SERVICE_PORT || '3003'),
        },
      },
    ]),
    ClientsModule.register([
      {
        name: CHATBOT_SERVICE,
        transport: Transport.TCP,
        options: {
          host: process.env.CHATBOT_SERVICE_HOST || 'localhost',
          port: parseInt(process.env.CHATBOT_SERVICE_PORT || '3004'),
        },
      },
    ]),
  ],
  controllers: [UserController, PaymentController, ChatbotController],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsHttpFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationRequestIdMiddleware).forRoutes('*');
  }
}
