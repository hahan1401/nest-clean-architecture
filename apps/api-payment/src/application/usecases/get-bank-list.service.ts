import { Inject, Injectable } from '@nestjs/common';
import { VnPayPort } from '../../domain/ports/vnpay.port';
import { GetBankListUseCase } from '../../domain/usecases/get-bank-list.usecase';

@Injectable()
export class GetBankListService implements GetBankListUseCase {
  constructor(private readonly vnpayService: VnPayPort) {}

  async execute(): Promise<any> {
    return this.vnpayService.getBankLink();
  }
}
