import { Injectable } from '@nestjs/common';
import { VnPayPort } from '../../domain/ports/vnpay.port';
import { BuildPaymentUrlUseCase } from '../../domain/usecases/build-payment-url.usecase';

@Injectable()
export class BuildPaymentUrlService implements BuildPaymentUrlUseCase {
  constructor(private readonly vnpayPort: VnPayPort) {}

  async execute(payload: any): Promise<string> {
    return this.vnpayPort.buildPaymentUrl(payload);
  }
}
