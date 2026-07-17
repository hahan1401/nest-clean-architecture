import { PAYMENT_SERVICE, USER_SERVICE } from '@app/common';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { CorrelationRequestIdMiddleware } from 'libs/middlewares/correlationRequestId.middleware';
import { LoggerModule } from 'nestjs-pino';
import { join } from 'path';
import { PaymentController } from './controllers/payment.controller';
import { UserController } from './controllers/user.controller';
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
      pinoHttp: {
        customProps: (req: any) => ({
          body: req.body,
        }),
        autoLogging: false,
        serializers: {
          req: (req) => {
            return {
              url: req.url.split('?')[0],
              method: req.method,
              requestId: req['requestId'],
              query: req.query,
              body: req.body,
            };
          },
          res: () => undefined,
        },
        transport: {
          target: 'pino-pretty',
          options: {
            singleLine: true,
            translateTime: 'yyyy-mm-dd"T"HH:MM:ss.l"Z"',
            ignore: 'pid,hostname',
            messageFormat: '[API-GATEWAY] {msg}',
          },
        },
      },
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
  ],
  controllers: [UserController, PaymentController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationRequestIdMiddleware).forRoutes('*');
  }
}
