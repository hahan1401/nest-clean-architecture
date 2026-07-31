import { PAYMENT_PATTERNS, PAYMENT_SERVICE } from '@app/common';
import { Controller, Get, Inject, Post, Query } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';

@Controller('payment')
export class PaymentController {
  @Inject(PAYMENT_SERVICE) private readonly paymentClient: ClientProxy;

  @Get('/bank-list')
  bankList() {
    return lastValueFrom(this.paymentClient.send(PAYMENT_PATTERNS.BANK_LIST, {}));
  }

  @Post('/generate-qr')
  generateQr() {
    return lastValueFrom(this.paymentClient.send(PAYMENT_PATTERNS.GENERATE_QR, {}));
  }

  @Post('/generate-payment-url')
  generatePaymentUrl() {
    return lastValueFrom(this.paymentClient.send(PAYMENT_PATTERNS.GENERATE_URL, {}));
  }

  @Post('/generate-return-url')
  generateReturnUrl() {
    return lastValueFrom(this.paymentClient.send(PAYMENT_PATTERNS.RETURN_URL, {}));
  }

  @Get('/ipn')
  ipn(@Query() query: any) {
    return query;
  }
}
