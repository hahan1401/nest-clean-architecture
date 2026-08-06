import { Injectable } from '@nestjs/common';
import { Bank } from 'vnpay';
import { VnPayPort } from '../../domain/ports/vnpay.port';
import { GetBankListUseCase } from '../../domain/usecases/get-bank-list.usecase';

@Injectable()
export class GetBankListService implements GetBankListUseCase {
  constructor(private readonly vnpayService: VnPayPort) {}

  async execute(): Promise<Bank[]> {
    return this.vnpayService.getBankLink();
  }
}
