/**
 * Daily maintenance jobs. Each returns the number of rows it changed, so the
 * scheduler can log it and a second run can be seen to be a no-op.
 */
export interface MaintenanceJobUseCase {
  execute(now?: Date): Promise<number>;
}

/**
 * Not a MaintenanceJobUseCase: this one is aimed at a single booking by a
 * delayed message, and answers "did it apply" rather than "how many rows".
 */
export interface ExpireBookingHoldUseCase {
  execute(bookingId: number, now?: Date): Promise<boolean>;
}
export type CloseElapsedDeparturesUseCase = MaintenanceJobUseCase;
export type CompleteElapsedBookingsUseCase = MaintenanceJobUseCase;
