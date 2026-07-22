import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { VnpayModule, VnpayService } from 'nestjs-vnpay';
import { ignoreLogger } from 'vnpay';
import { MyVnpayService } from '../../infrastructure/services/vnpay.service';
import { PaymentController } from '../controllers/payment.controller';
import { GetBankListService } from '../../application/usecases/get-bank-list.service';
import { VnPayPort } from '../../domain/ports/vnpay.port';
import { GeneratePaymentQrCodeService } from '../../application/usecases/generate-payment-qr-code.service';
import { BuildPaymentUrlService } from '../../application/usecases/build-payment-url.service';
import { VerifyReturnUrlService } from '../../application/usecases/verify-return-url.service';
import { VerifyIpnCallService } from '../../application/usecases/verify-ipn-call.service';

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
  providers: [
    {
      provide: VnPayPort,
      useClass: MyVnpayService,
    },
    GetBankListService,
    GeneratePaymentQrCodeService,
    BuildPaymentUrlService,
    VerifyReturnUrlService,
    VerifyIpnCallService,
  ],
  controllers: [PaymentController],
})
export class ApiPaymentModule {}
