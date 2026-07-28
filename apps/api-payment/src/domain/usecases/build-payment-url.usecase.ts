export interface BuildPaymentUrlUseCase {
  execute(payload: any): Promise<string>;
}
