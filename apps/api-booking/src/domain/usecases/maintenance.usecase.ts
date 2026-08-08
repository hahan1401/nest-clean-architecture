/**
 * Daily maintenance jobs. Each returns the number of rows it changed, so the
 * scheduler can log it and a second run can be seen to be a no-op.
 */
export interface MaintenanceJobUseCase {
  execute(now?: Date): Promise<number>;
}

export type ExpireStaleHoldsUseCase = MaintenanceJobUseCase;
export type CloseElapsedDeparturesUseCase = MaintenanceJobUseCase;
export type CompleteElapsedBookingsUseCase = MaintenanceJobUseCase;
