import { ConflictError, NotFoundError, ValidationError } from '@app/common';
import { Booking, DepartureStatus } from '@app/database';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { nowHouseDayStart } from '../../domain/models/house-clock';
import { PricingPort } from '../../domain/ports/pricing.port';
import {
  BookingRepository,
  CreateRoomBookingData,
  CreateTourBookingData,
} from '../../domain/repositories/booking.repository';
import { RoomRepository } from '../../domain/repositories/room.repository';
import { TourDepartureRepository } from '../../domain/repositories/tour-departure.repository';
import { TourRepository } from '../../domain/repositories/tour.repository';
import {
  generateBookingReference,
  generateCancellationToken,
} from '../../domain/services/booking-reference';
import { BookingHoldSchedulerPort } from '../../domain/ports/booking-hold-scheduler.port';
import { CreateBookingInput, CreateBookingUseCase } from '../../domain/usecases/booking.usecase';
import { assertStayRange } from './room.service';

/** Exported so the spec asserts the wiring rather than pinning a tuned number. */
export const DEFAULT_HOLD_TTL_MINUTES = 1;

/**
 * Creates a PENDING booking that holds its slot until confirmed or swept.
 *
 * One use case, not two: `POST /bookings` is a single route, and splitting on
 * type would duplicate the customer capture, the quote freeze, and the
 * reference/token generation for no gain.
 */
@Injectable()
export class CreateBookingService implements CreateBookingUseCase {
  private readonly holdTtlMs: number;

  constructor(
    private readonly bookingRepository: BookingRepository,
    private readonly roomRepository: RoomRepository,
    private readonly tourRepository: TourRepository,
    private readonly departureRepository: TourDepartureRepository,
    private readonly pricing: PricingPort,
    private readonly holdScheduler: BookingHoldSchedulerPort,
    private readonly configService: ConfigService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(CreateBookingService.name);
    const minutes =
      this.configService.get<number>('BOOKING_HOLD_TTL_MINUTES') ?? DEFAULT_HOLD_TTL_MINUTES;
    this.holdTtlMs = Number(minutes) * 60_000;
  }

  async execute(input: CreateBookingInput): Promise<Booking> {
    const booking =
      input.type === 'ROOM'
        ? await this.createRoomBooking(input)
        : await this.createTourBooking(input);

    // Arrange the release now, at the one moment we know a hold has started.
    // Best effort by contract: the booking is already committed, and a message
    // that never gets published is picked up by the reconciliation sweep.
    //
    // The .catch() is belt-and-braces for an implementation that breaks that
    // contract - the row exists either way, and answering the guest with an
    // error would lose a sale that the database has already accepted.
    if (booking.holdExpiresAt) {
      await this.holdScheduler
        .scheduleExpiry(booking.id, booking.holdExpiresAt)
        .catch((error: unknown) => {
          this.logger.error(
            { err: error, bookingId: booking.id, reference: booking.reference },
            'Booking held but its expiry could not be scheduled',
          );
        });
    }

    return booking;
  }

  private common() {
    return {
      reference: generateBookingReference(),
      cancellationToken: generateCancellationToken(),
      holdExpiresAt: new Date(Date.now() + this.holdTtlMs),
    };
  }

  private async createRoomBooking(
    input: Extract<CreateBookingInput, { type: 'ROOM' }>,
  ): Promise<Booking> {
    assertStayRange(input.range);
    if (input.range.from < nowHouseDayStart()) {
      throw new ValidationError('checkIn cannot be in the past');
    }

    const room = await this.roomRepository.findById(input.roomId);
    if (!room) {
      throw new NotFoundError(`Room with id ${input.roomId} not found`);
    }
    if (!room.isActive) {
      throw new ConflictError(`Room ${room.code} is not bookable`);
    }
    if (input.guests > room.maxGuests) {
      throw new ValidationError(`Room ${room.code} sleeps at most ${room.maxGuests} guests`);
    }

    const quote = await this.pricing.quoteRoomStay(room, input.range);

    const data: CreateRoomBookingData = {
      ...this.common(),
      roomId: room.id,
      range: input.range,
      guests: input.guests,
      customer: input.customer,
      notes: input.notes ?? null,
      quote,
    };

    // No pre-check here on purpose: the exclusion constraint inside the
    // repository is the only opinion that cannot be raced. A null return means
    // someone else took the dates between the quote and the insert.
    const booking = await this.bookingRepository.createRoomBooking(data);
    if (!booking) {
      throw new ConflictError('Those dates are no longer available for this room');
    }
    return booking;
  }

  private async createTourBooking(
    input: Extract<CreateBookingInput, { type: 'TOUR' }>,
  ): Promise<Booking> {
    if (input.seats < 1) {
      throw new ValidationError('seats must be at least 1');
    }
    if (input.guests !== input.seats) {
      throw new ValidationError('guests must equal seats for a tour booking');
    }

    const departure = await this.departureRepository.findById(input.tourDepartureId);
    if (!departure) {
      throw new NotFoundError(`Tour departure with id ${input.tourDepartureId} not found`);
    }
    if (departure.status !== DepartureStatus.OPEN) {
      throw new ConflictError('That departure is no longer open for booking');
    }
    if (departure.departureDate < nowHouseDayStart()) {
      throw new ConflictError('That departure has already left');
    }

    const tour = await this.tourRepository.findById(departure.tourId);
    if (!tour) {
      throw new NotFoundError(`Tour with id ${departure.tourId} not found`);
    }
    if (!tour.isActive) {
      throw new ConflictError(`Tour ${tour.slug} is not bookable`);
    }

    const quote = await this.pricing.quoteTourSeats(tour, departure, input.seats);

    const data: CreateTourBookingData = {
      ...this.common(),
      tourDepartureId: departure.id,
      seats: input.seats,
      guests: input.guests,
      customer: input.customer,
      notes: input.notes ?? null,
      quote,
    };

    // Same reasoning as rooms: the conditional seat UPDATE decides, not a read.
    const booking = await this.bookingRepository.createTourBooking(data);
    if (!booking) {
      throw new ConflictError('That departure no longer has enough seats');
    }
    return booking;
  }
}
