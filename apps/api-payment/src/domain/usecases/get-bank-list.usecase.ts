export interface GetBankListUseCase {
  execute(): Promise<string[]>;
}
