import { PAYMENT_PATTERNS, PAYMENT_SERVICE } from '@app/common';
import { Controller, Get, HttpException, Inject, Post } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';

@Controller('payment')
export class PaymentController {
  @Inject(PAYMENT_SERVICE) private readonly paymentClient: ClientProxy;

  @Get('/bank-list')
  async bankList() {
    return lastValueFrom(
      this.paymentClient.send(PAYMENT_PATTERNS.BANK_LIST, {}),
    ).catch((err) => {
      throw new HttpException(
        err?.message ?? 'Internal error',
        err?.status ?? 500,
      );
    });
  }

  @Post('/generate-qr')
  async generateQr() {
    return lastValueFrom(
      this.paymentClient.send(PAYMENT_PATTERNS.GENERATE_QR, {}),
    ).catch((err) => {
      throw new HttpException(
        err?.message ?? 'Internal error',
        err?.status ?? 500,
      );
    });
  }

  @Post('/generate-payment-url')
  async generatePaymentUrl() {
    return lastValueFrom(
      this.paymentClient.send(PAYMENT_PATTERNS.GENERATE_URL, {}),
    ).catch((err) => {
      throw new HttpException(
        err?.message ?? 'Internal error',
        err?.status ?? 500,
      );
    });
  }

  @Post('/generate-return-url')
  async generateReturnUrl() {
    return lastValueFrom(
      this.paymentClient.send(PAYMENT_PATTERNS.RETURN_URL, {}),
    ).catch((err) => {
      throw new HttpException(
        err?.message ?? 'Internal error',
        err?.status ?? 500,
      );
    });
  }
}
