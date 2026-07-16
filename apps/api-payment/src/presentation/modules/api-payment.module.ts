import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { VnpayModule } from 'nestjs-vnpay';
import { ignoreLogger } from 'vnpay';
import { MyVnpayService } from '../../infrastructure/services/vnpay.service';
import { PaymentController } from '../controllers/payment.controller';

@Module({
  imports: [
    ConfigModule,
    VnpayModule.registerAsync({
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secureSecret: configService.getOrThrow<string>('vnp_HashSecret'),
        tmnCode: configService.getOrThrow<string>('vnp_TmnCode'),
        vnpayHost: 'https://sandbox.vnpayment.vn',

        // Cấu hình tùy chọn
        testMode: true, // Chế độ test (ghi đè vnpayHost thành sandbox nếu là true)
        enableLog: true, // Bật/tắt ghi log
        loggerFn: ignoreLogger, // Hàm xử lý log tùy chỉnh
      }),
    }),
  ],
  providers: [MyVnpayService],
  controllers: [PaymentController],
})
export class ApiPaymentModule {}
