import { Injectable } from '@nestjs/common';
import { VerifyReturnUrl } from 'vnpay';
import { VnPayPort } from '../../domain/ports/vnpay.port';
import { VerifyReturnUrlUseCase } from '../../domain/usecases/verify-return-url.usecase';

@Injectable()
export class VerifyReturnUrlService implements VerifyReturnUrlUseCase {
  constructor(private readonly vnpayPort: VnPayPort) {}

  async execute(query: any): Promise<VerifyReturnUrl> {
    return this.vnpayPort.verifyReturnUrl(query);
  }
}
