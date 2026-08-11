import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { PaymentRequest, VnPayPort } from '../../domain/ports/vnpay.port';
import { VnpayService } from 'nestjs-vnpay';
import {
  Bank,
  BuildPaymentUrl,
  dateFormat,
  GenerateQrResponse,
  ProductCode,
  ReturnQueryFromVNPay,
  VerifyIpnCall,
  VerifyReturnUrl,
  VnpCurrCode,
  VnpLocale,
} from 'vnpay';

/** vnpay's BuildPaymentUrl omits the billing/version fields that VNPay still accepts. */
type VnpayPaymentPayload = BuildPaymentUrl & {
  vnp_Version?: string;
  vnp_Command?: string;
  vnp_Bill_Mobile?: string;
  vnp_Bill_Email?: string;
};

@Injectable()
export class MyVnpayService extends VnPayPort {
  constructor(
    private readonly configService: ConfigService,
    @Inject(VnpayService) private readonly vnpayService: VnpayService,
    private readonly logger: PinoLogger,
  ) {
    super();
  }

  async getBankLink(): Promise<Bank[]> {
    return this.vnpayService.getBankList();
  }

  private buildPaymentPayload(payload: PaymentRequest): VnpayPaymentPayload {
    const amount = Number(payload?.amount ?? 1000);
    // vnpay package multiplies vnp_Amount by 100 internally, so pass the raw VND amount here.
    const vnpAmount = Number.isFinite(amount) ? Math.round(amount) : 10000;
    // Compute the ref first so orderInfo's fallback matches the ref actually sent as
    // vnp_TxnRef, instead of checking `transactionRef` alone and falling through to the
    // literal word "ORDER" whenever only `orderId` was supplied.
    const transactionRef = String(`${Date.now()}`);
    const orderInfo = payload?.orderInfo ?? `Thanh toan don hang ${transactionRef}`;
    const ipAddr =
      payload?.ipAddr?.trim() || this.configService.get<string>('VNPAY_IP_ADDR') || '172.20.10.2';
    const returnUrl =
      payload?.returnUrl ||
      this.configService.get<string>('VNPAY_RETURN_URL') ||
      'https://homestay-booking-fe-ecru.vercel.app/api/vnpay-ipn';

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
    };
  }

  async generatePaymentQrCode(payload: PaymentRequest): Promise<GenerateQrResponse> {
    const payloadData = this.buildPaymentPayload(payload);
    this.logger.info({ payloadData }, 'vnpay payload data');

    return this.vnpayService.generateQr(payloadData);
  }

  async buildPaymentUrl(payload: PaymentRequest): Promise<string> {
    const payloadData = this.buildPaymentPayload(payload);
    this.logger.info({ payloadData }, 'vnpay payload data');

    return this.vnpayService.buildPaymentUrl(payloadData);
  }

  async verifyReturnUrl(query: ReturnQueryFromVNPay): Promise<VerifyReturnUrl> {
    return this.vnpayService.verifyReturnUrl(query);
  }

  async verifyIpnCall(query: ReturnQueryFromVNPay): Promise<VerifyIpnCall> {
    return this.vnpayService.verifyIpnCall(query);
  }
}
