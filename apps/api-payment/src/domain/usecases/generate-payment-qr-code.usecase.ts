import { GenerateQrResponse } from 'vnpay';
import { PaymentRequest } from '../ports/vnpay.port';

export interface GeneratePaymentQrCodeUseCase {
  execute(payload: PaymentRequest): Promise<GenerateQrResponse>;
}
