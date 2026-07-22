import { PAYMENT_PATTERNS, PAYMENT_SERVICE } from '@app/common';
import { Controller, Get, HttpException, Inject, Logger, Post, Query } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';

@Controller('payment')
export class PaymentController {
  @Inject(PAYMENT_SERVICE) private readonly paymentClient: ClientProxy;
  private readonly logger: Logger = new Logger(PaymentController.name);

  @Get('/bank-list')
  async bankList() {
    return lastValueFrom(this.paymentClient.send(PAYMENT_PATTERNS.BANK_LIST, {})).catch((err) => {
      throw new HttpException(err?.message ?? 'Internal error', err?.status ?? 500);
    });
  }

  @Post('/generate-qr')
  async generateQr() {
    return lastValueFrom(this.paymentClient.send(PAYMENT_PATTERNS.GENERATE_QR, {})).catch((err) => {
      throw new HttpException(err?.message ?? 'Internal error', err?.status ?? 500);
    });
  }

  @Post('/generate-payment-url')
  async generatePaymentUrl() {
    return lastValueFrom(this.paymentClient.send(PAYMENT_PATTERNS.GENERATE_URL, {})).catch(
      (err) => {
        throw new HttpException(err?.message ?? 'Internal error', err?.status ?? 500);
      },
    );
  }

  @Post('/generate-return-url')
  async generateReturnUrl() {
    return lastValueFrom(this.paymentClient.send(PAYMENT_PATTERNS.RETURN_URL, {})).catch((err) => {
      throw new HttpException(err?.message ?? 'Internal error', err?.status ?? 500);
    });
  }

  @Get('/ipn')
  async ipn(@Query() query: any) {
    return query;
    // return lastValueFrom(
    //   this.paymentClient.send(PAYMENT_PATTERNS.IPN, {}),
    // ).catch((err) => {
    //   throw new HttpException(
    //     err?.message ?? 'Internal error',
    //     err?.status ?? 500,
    //   );
    // });
  }
}
