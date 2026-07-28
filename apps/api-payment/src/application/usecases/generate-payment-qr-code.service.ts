import { Injectable } from '@nestjs/common';
import { VnPayPort } from '../../domain/ports/vnpay.port';
import { GeneratePaymentQrCodeUseCase } from '../../domain/usecases/generate-payment-qr-code.usecase';

@Injectable()
export class GeneratePaymentQrCodeService implements GeneratePaymentQrCodeUseCase {
  constructor(private readonly vnpayPort: VnPayPort) {}

  async execute(payload: any): Promise<any> {
    return this.vnpayPort.generatePaymentQrCode(payload);
  }
}
