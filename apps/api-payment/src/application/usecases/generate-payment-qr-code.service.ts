import { Injectable } from '@nestjs/common';
import { GenerateQrResponse } from 'vnpay';
import { PaymentRequest, VnPayPort } from '../../domain/ports/vnpay.port';
import { GeneratePaymentQrCodeUseCase } from '../../domain/usecases/generate-payment-qr-code.usecase';

@Injectable()
export class GeneratePaymentQrCodeService implements GeneratePaymentQrCodeUseCase {
  constructor(private readonly vnpayPort: VnPayPort) {}

  async execute(payload: PaymentRequest): Promise<GenerateQrResponse> {
    return this.vnpayPort.generatePaymentQrCode(payload);
  }
}
