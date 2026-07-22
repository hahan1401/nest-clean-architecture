import { Injectable } from '@nestjs/common';
import { VnPayPort } from '../../domain/ports/vnpay.port';

@Injectable()
export class GeneratePaymentQrCodeService {
  constructor(private readonly vnpayPort: VnPayPort) {}

  async execute(payload: any): Promise<any> {
    return this.vnpayPort.generatePaymentQrCode(payload);
  }
}
