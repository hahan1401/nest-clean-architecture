import { PaymentRequest } from '../ports/vnpay.port';

export interface BuildPaymentUrlUseCase {
  execute(payload: PaymentRequest): Promise<string>;
}
