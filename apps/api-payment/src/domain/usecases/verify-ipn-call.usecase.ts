import { VerifyIpnCall } from "vnpay";

export interface VerifyIpnCallUseCase {
  execute(query: any): Promise<VerifyIpnCall>;
}