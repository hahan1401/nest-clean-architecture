import { PAYMENT_PATTERNS } from '@app/common';
import { Controller, Get, Inject, Query } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { MyVnpayService } from '../../infrastructure/services/vnpay.service';

@Controller('payment')
export class PaymentController {
  @Inject()
  private readonly myVnpayService: MyVnpayService;

  @MessagePattern(PAYMENT_PATTERNS.BANK_LIST)
  async bankList(data: any) {
    return this.myVnpayService.getBankLink();
  }

  @MessagePattern(PAYMENT_PATTERNS.GENERATE_QR)
  async generateQr(data: any) {
    return this.myVnpayService.generatePaymentQrCode(data);
  }

  @MessagePattern(PAYMENT_PATTERNS.GENERATE_URL)
  async generateUrl(data: any) {
    return this.myVnpayService.buildPaymentUrl(data);
  }

  @MessagePattern(PAYMENT_PATTERNS.RETURN_URL)
  async paymentReturn() {
    const result = await this.myVnpayService.verifyReturnUrl('');
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
    const result = await this.myVnpayService.verifyIpnCall(query);
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
