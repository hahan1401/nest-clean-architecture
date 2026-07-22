import { Inject, Injectable } from '@nestjs/common';
import { VnPayPort } from '../../domain/ports/vnpay.port';

@Injectable()
export class GetBankListService {
  constructor(private readonly vnpayService: VnPayPort) {}

  async execute(): Promise<any> {
    return this.vnpayService.getBankLink();
  }
}
