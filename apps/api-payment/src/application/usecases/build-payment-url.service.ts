import { Injectable } from '@nestjs/common';
import { PaymentRequest, VnPayPort } from '../../domain/ports/vnpay.port';
import { BuildPaymentUrlUseCase } from '../../domain/usecases/build-payment-url.usecase';

@Injectable()
export class BuildPaymentUrlService implements BuildPaymentUrlUseCase {
  constructor(private readonly vnpayPort: VnPayPort) {}

  async execute(payload: PaymentRequest): Promise<string> {
    return this.vnpayPort.buildPaymentUrl(payload);
  }
}
