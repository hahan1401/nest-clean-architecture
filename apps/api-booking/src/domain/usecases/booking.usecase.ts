import type { Booking } from '@app/database';
import type { DateRange } from '../models/date-range';
import type { BookingCustomerData } from '../repositories/booking.repository';

interface CreateBookingCommon {
  guests: number;
  customer: BookingCustomerData;
  notes?: string | null;
  requestId?: string;
}

export type CreateBookingInput =
  | (CreateBookingCommon & { type: 'ROOM'; roomId: number; range: DateRange })
  | (CreateBookingCommon & { type: 'TOUR'; tourDepartureId: number; seats: number });

export interface CreateBookingUseCase {
  execute(input: CreateBookingInput): Promise<Booking>;
}

export interface ConfirmBookingInput {
  bookingId: number;
  requestId?: string;
}

export interface ConfirmBookingUseCase {
  execute(input: ConfirmBookingInput): Promise<Booking>;
}

export interface CancelBookingInput {
  bookingId: number;
  reason?: string | null;
}

export interface CancelBookingUseCase {
  execute(input: CancelBookingInput): Promise<Booking>;
}

export interface GetBookingUseCase {
  execute(id: number): Promise<Booking>;
}

export interface GetBookingByReferenceUseCase {
  execute(reference: string): Promise<Booking>;
}

/** Read-only lookup behind the emailed cancel link; must not change state. */
export interface GetBookingByCancellationTokenUseCase {
  execute(token: string): Promise<Booking>;
}

export interface CancelBookingByTokenInput {
  token: string;
  reason?: string | null;
}

export interface CancelBookingByTokenUseCase {
  execute(input: CancelBookingByTokenInput): Promise<Booking>;
}
