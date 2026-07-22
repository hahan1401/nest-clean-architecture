import { Injectable } from '@nestjs/common';
import { VerifyReturnUrl } from 'vnpay';
import { VnPayPort } from '../../domain/ports/vnpay.port';

@Injectable()
export class VerifyReturnUrlService {
  constructor(private readonly vnpayPort: VnPayPort) {}

  async execute(query: any): Promise<VerifyReturnUrl> {
    return this.vnpayPort.verifyReturnUrl(query);
  }
}
