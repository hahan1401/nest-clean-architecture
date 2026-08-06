import {
  Bank,
  GenerateQrResponse,
  ProductCode,
  ReturnQueryFromVNPay,
  VerifyIpnCall,
  VerifyReturnUrl,
  VnpLocale,
} from 'vnpay';

/** Caller-supplied payment details; every field falls back to a configured default. */
export type PaymentRequest = {
  amount?: number;
  orderInfo?: string;
  transactionRef?: string;
  orderId?: string;
  ipAddr?: string;
  returnUrl?: string;
  orderType?: ProductCode;
  locale?: VnpLocale;
  bankCode?: string;
  billingMobile?: string;
  billingEmail?: string;
};

export abstract class VnPayPort {
  abstract getBankLink(): Promise<Bank[]>;
  abstract generatePaymentQrCode(payload: PaymentRequest): Promise<GenerateQrResponse>;
  abstract buildPaymentUrl(payload: PaymentRequest): Promise<string>;
  abstract verifyReturnUrl(query: ReturnQueryFromVNPay): Promise<VerifyReturnUrl>;
  abstract verifyIpnCall(query: ReturnQueryFromVNPay): Promise<VerifyIpnCall>;
}
