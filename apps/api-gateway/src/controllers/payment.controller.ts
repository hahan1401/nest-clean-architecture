import { GeneratePaymentDto, PAYMENT_PATTERNS, PAYMENT_SERVICE } from '@app/common';
import type { CorrelatedRequest } from '@app/common';
import { Body, Controller, Get, Inject, Post, Query, Req } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';
import type { GenerateQrResponse } from 'vnpay';

@Controller('payment')
export class PaymentController {
  @Inject(PAYMENT_SERVICE) private readonly paymentClient: ClientProxy;

  @Get('/bank-list')
  bankList() {
    return lastValueFrom(this.paymentClient.send(PAYMENT_PATTERNS.BANK_LIST, {}));
  }

  @Post('/generate-qr')
  generateQr(@Req() req: CorrelatedRequest, @Body() dto: GeneratePaymentDto) {
    return lastValueFrom(
      this.paymentClient.send<GenerateQrResponse>(PAYMENT_PATTERNS.GENERATE_QR, {
        ...dto,
        requestId: req.requestId,
      }),
    );
  }

  @Post('/generate-payment-url')
  generatePaymentUrl(@Req() req: CorrelatedRequest, @Body() dto: GeneratePaymentDto) {
    return lastValueFrom(
      this.paymentClient.send<string>(PAYMENT_PATTERNS.GENERATE_URL, {
        ...dto,
        requestId: req.requestId,
      }),
    );
  }

  @Post('/generate-return-url')
  generateReturnUrl() {
    return lastValueFrom(this.paymentClient.send(PAYMENT_PATTERNS.RETURN_URL, {}));
  }

  @Get('/ipn')
  ipn(@Query() query: Record<string, string>) {
    return query;
  }
}
