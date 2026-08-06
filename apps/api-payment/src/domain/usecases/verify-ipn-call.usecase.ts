import { ReturnQueryFromVNPay, VerifyIpnCall } from 'vnpay';

export interface VerifyIpnCallUseCase {
  execute(query: ReturnQueryFromVNPay): Promise<VerifyIpnCall>;
}
