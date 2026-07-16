import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VnPayPort } from '../../domain/ports/vnpay.port';
import { VnpayService } from 'nestjs-vnpay';
import {
  Bank,
  BuildPaymentUrl,
  dateFormat,
  ProductCode,
  ReturnQueryFromVNPay,
  VerifyIpnCall,
  VerifyReturnUrl,
  VnpCurrCode,
  VnpLocale,
} from 'vnpay';

@Injectable()
export class MyVnpayService extends VnPayPort {
  constructor(
    private readonly configService: ConfigService,
    @Inject(VnpayService) private readonly vnpayService: VnpayService,
  ) {
    super();
  }

  async getBankLink(): Promise<Bank[]> {
    return this.vnpayService.getBankList();
  }

  private buildPaymentPayload(payload: any): BuildPaymentUrl {
    const amount = Number(payload?.amount ?? 10);
    const vnpAmount = Number.isFinite(amount) ? Math.round(amount * 100) : 10000 * 100;
    const orderInfo =
      payload?.orderInfo ?? `Thanh toan don hang ${payload?.transactionRef ?? 'ORDER'}`;
    const transactionRef = String(
      payload?.transactionRef ?? payload?.orderId ?? `ORD-${Date.now()}`,
    );
    const ipAddr =
      payload?.ipAddr ??
      this.configService.get<string>('VNPAY_IP_ADDR') ??
      '127.0.0.1';
    const returnUrl =
      payload?.returnUrl ??
      this.configService.get<string>('VNPAY_RETURN_URL') ??
      'http://localhost:3000/payment/return';

    const start = new Date();
    const end = new Date(start.getTime() + 15 * 60 * 1000);

    return {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_Amount: vnpAmount,
      vnp_IpAddr: ipAddr,
      vnp_TxnRef: transactionRef,
      vnp_OrderInfo: orderInfo,
      vnp_OrderType: payload?.orderType ?? ProductCode.Other,
      vnp_ReturnUrl: returnUrl,
      vnp_Locale: payload?.locale ?? VnpLocale.VN,
      vnp_CreateDate: dateFormat(start),
      vnp_ExpireDate: dateFormat(end),
      vnp_CurrCode: VnpCurrCode.VND,
      ...(payload?.bankCode ? { vnp_BankCode: payload.bankCode } : {}),
      ...(payload?.billingMobile ? { vnp_Bill_Mobile: payload.billingMobile } : {}),
      ...(payload?.billingEmail ? { vnp_Bill_Email: payload.billingEmail } : {}),
    } as BuildPaymentUrl;
  }

  async generatePaymentQrCode(payload: any): Promise<any> {
    const payloadData = this.buildPaymentPayload(payload);

    console.log('vnpay payload data: ', payloadData);

    return this.vnpayService.generateQr(payloadData);
  }

  async buildPaymentUrl(payload: any): Promise<string> {
    return this.vnpayService.buildPaymentUrl(this.buildPaymentPayload(payload));
  }

  async verifyReturnUrl(query: any): Promise<VerifyReturnUrl> {
    return this.vnpayService.verifyReturnUrl(query as ReturnQueryFromVNPay);
  }

  async verifyIpnCall(query: any): Promise<VerifyIpnCall> {
    return this.vnpayService.verifyIpnCall(query as ReturnQueryFromVNPay);
  }
}
