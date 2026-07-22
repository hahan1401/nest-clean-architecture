import { Bank } from 'vnpay';

export abstract class VnPayPort {
  abstract getBankLink(): Promise<Bank[]>;
  abstract generatePaymentQrCode(payload: any): Promise<any>;
  abstract buildPaymentUrl(payload: any): Promise<string>;
  abstract verifyReturnUrl(query: any): Promise<any>;
  abstract verifyIpnCall(query: any): Promise<any>;
}
