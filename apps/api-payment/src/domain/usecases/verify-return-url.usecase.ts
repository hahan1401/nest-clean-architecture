import { ReturnQueryFromVNPay, VerifyReturnUrl } from 'vnpay';

export interface VerifyReturnUrlUseCase {
  execute(query: ReturnQueryFromVNPay): Promise<VerifyReturnUrl>;
}
