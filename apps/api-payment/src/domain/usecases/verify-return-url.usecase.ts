import { VerifyReturnUrl } from 'vnpay';

export interface VerifyReturnUrlUseCase {
  execute(query: any): Promise<VerifyReturnUrl>;
}
