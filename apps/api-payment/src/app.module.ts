import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { join } from 'path';
import { LoggerMiddleware } from 'libs/middlewares/logger.middleware';
import { ApiPaymentModule } from './presentation/modules/api-payment.module';
import { MyVnpayService } from './infrastructure/services/vnpay.service';
import { PaymentController } from './presentation/controllers/payment.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        join(process.cwd(), '.env.local'),
        join(process.cwd(), 'apps/api-payment/.env.local'),
      ],
    }),
    ApiPaymentModule
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
