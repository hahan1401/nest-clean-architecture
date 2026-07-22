import { Injectable } from '@nestjs/common';
import { VnPayPort } from '../../domain/ports/vnpay.port';

@Injectable()
export class BuildPaymentUrlService {
  constructor(private readonly vnpayPort: VnPayPort) {}

  async execute(payload: any): Promise<string> {
    return this.vnpayPort.buildPaymentUrl(payload);
  }
}
