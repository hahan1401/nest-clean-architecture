import { Bank } from 'vnpay';

export interface GetBankListUseCase {
  execute(): Promise<Bank[]>;
}
