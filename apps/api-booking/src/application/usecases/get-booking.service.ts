import { NotFoundError } from '@app/common';
import { Booking } from '@app/database';
import { Injectable } from '@nestjs/common';
import { BookingRepository } from '../../domain/repositories/booking.repository';
import {
  GetBookingByReferenceUseCase,
  GetBookingUseCase,
} from '../../domain/usecases/booking.usecase';

@Injectable()
export class GetBookingService implements GetBookingUseCase {
  constructor(private readonly bookingRepository: BookingRepository) {}

  async execute(id: number): Promise<Booking> {
    const booking = await this.bookingRepository.findById(id);
    if (!booking) {
      throw new NotFoundError(`Booking with id ${id} not found`);
    }
    return booking;
  }
}

@Injectable()
export class GetBookingByReferenceService implements GetBookingByReferenceUseCase {
  constructor(private readonly bookingRepository: BookingRepository) {}

  async execute(reference: string): Promise<Booking> {
    const booking = await this.bookingRepository.findByReference(reference);
    if (!booking) {
      throw new NotFoundError(`Booking with reference ${reference} not found`);
    }
    return booking;
  }
}
