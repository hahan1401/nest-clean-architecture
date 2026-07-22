import { Injectable } from '@nestjs/common';
import { VerifyIpnCall } from 'vnpay';
import { VnPayPort } from '../../domain/ports/vnpay.port';

@Injectable()
export class VerifyIpnCallService {
  constructor(private readonly vnpayPort: VnPayPort) {}

  async execute(query: any): Promise<VerifyIpnCall> {
    return this.vnpayPort.verifyIpnCall(query);
  }
}
