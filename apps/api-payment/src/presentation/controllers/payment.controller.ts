import { PAYMENT_PATTERNS } from '@app/common';
import { Controller, Get, Inject, Query } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { BuildPaymentUrlService } from '../../application/usecases/build-payment-url.service';
import { GeneratePaymentQrCodeService } from '../../application/usecases/generate-payment-qr-code.service';
import { GetBankListService } from '../../application/usecases/get-bank-list.service';
import { VerifyIpnCallService } from '../../application/usecases/verify-ipn-call.service';
import { VerifyReturnUrlService } from '../../application/usecases/verify-return-url.service';

@Controller('payment')
export class PaymentController {
  @Inject()
  private readonly getBankListService: GetBankListService;
  @Inject()
  private readonly generatePaymentQrCodeService: GeneratePaymentQrCodeService;
  @Inject()
  private readonly buildPaymentUrlService: BuildPaymentUrlService;
  @Inject()
  private readonly verifyReturnUrlService: VerifyReturnUrlService;
  @Inject()
  private readonly verifyIpnCallService: VerifyIpnCallService;

  @MessagePattern(PAYMENT_PATTERNS.BANK_LIST)
  async bankList(data: any) {
    return this.getBankListService.execute();
  }

  @MessagePattern(PAYMENT_PATTERNS.GENERATE_QR)
  async generateQr(data: any) {
    return this.generatePaymentQrCodeService.execute(data);
  }

  @MessagePattern(PAYMENT_PATTERNS.GENERATE_URL)
  async generateUrl(data: any) {
    return this.buildPaymentUrlService.execute(data);
  }

  @MessagePattern(PAYMENT_PATTERNS.RETURN_URL)
  async paymentReturn() {
    const result = await this.verifyReturnUrlService.execute('');
    return {
      verified: result.isVerified,
      success: result.isSuccess,
      message: result.message,
      transaction: result.vnp_TxnRef,
      amount: result.vnp_Amount,
      data: result,
    };
  }

  @Get('ipn')
  async paymentIpn(@Query() query: any) {
    const result = await this.verifyIpnCallService.execute(query);
    const isVerified = result?.isVerified === true;
    const isSuccess = result?.isSuccess === true;
    return {
      RspCode: isVerified ? (isSuccess ? '00' : '02') : '97',
      Message: isVerified
        ? isSuccess
          ? 'Confirm Success'
          : 'Transaction failed'
        : 'Invalid signature',
      transaction: result.vnp_TxnRef,
      amount: result.vnp_Amount,
    };
  }
}
