import { Injectable } from '@nestjs/common';
import { ReturnQueryFromVNPay, VerifyIpnCall } from 'vnpay';
import { VnPayPort } from '../../domain/ports/vnpay.port';
import { VerifyIpnCallUseCase } from '../../domain/usecases/verify-ipn-call.usecase';

@Injectable()
export class VerifyIpnCallService implements VerifyIpnCallUseCase {
  constructor(private readonly vnpayPort: VnPayPort) {}

  async execute(query: ReturnQueryFromVNPay): Promise<VerifyIpnCall> {
    return this.vnpayPort.verifyIpnCall(query);
  }
}
