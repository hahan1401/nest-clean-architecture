import { ConflictError, NotFoundError } from '@app/common';
import { Booking, BookingStatus } from '@app/database';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { BookingDetail } from '../../domain/models/booking-detail';
import { nightCount } from '../../domain/models/date-range';
import {
  BookingConfirmedNotification,
  BookingNotifierPort,
} from '../../domain/ports/booking-notifier.port';
import { BookingRepository } from '../../domain/repositories/booking.repository';
import { ConfirmBookingInput, ConfirmBookingUseCase } from '../../domain/usecases/booking.usecase';

@Injectable()
export class ConfirmBookingService implements ConfirmBookingUseCase {
  private readonly publicBaseUrl: string;

  constructor(
    private readonly bookingRepository: BookingRepository,
    private readonly notifier: BookingNotifierPort,
    private readonly configService: ConfigService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(ConfirmBookingService.name);
    // Trailing slash trimmed so the built link never contains "//bookings".
    this.publicBaseUrl = this.configService
      .getOrThrow<string>('PUBLIC_BASE_URL')
      .replace(/\/+$/, '');
  }

  async execute(input: ConfirmBookingInput): Promise<Booking> {
    const detail = await this.bookingRepository.findDetailedById(input.bookingId);
    if (!detail) {
      throw new NotFoundError(`Booking with id ${input.bookingId} not found`);
    }

    const { booking } = detail;
    if (booking.status === BookingStatus.CONFIRMED) {
      throw new ConflictError(`Booking ${booking.reference} is already confirmed`);
    }
    if (booking.status !== BookingStatus.PENDING) {
      throw new ConflictError(
        `Booking ${booking.reference} is ${booking.status.toLowerCase()} and cannot be confirmed`,
      );
    }

    // Step 1: commit the state transition. The conditional update is the real
    // guard - two concurrent confirms produce exactly one winner, so the loser
    // never reaches the emails below.
    const confirmed = await this.bookingRepository.markConfirmed(booking.id, new Date());
    if (!confirmed) {
      throw new ConflictError(`Booking ${booking.reference} is no longer pending`);
    }

    this.logger.info(
      { bookingId: confirmed.id, reference: confirmed.reference, requestId: input.requestId },
      'Booking confirmed',
    );

    // Step 2: only now announce it. The port contract says this never throws and
    // the RMQ adapter honours it, so the recovery genuinely lives there. The
    // .catch() is belt-and-braces for a future implementation that breaks the
    // contract: the booking is already CONFIRMED in Postgres, and answering the
    // caller with an error would send them to retry straight into a 409.
    await this.notifier
      .notifyBookingConfirmed(this.toNotification(detail, confirmed, input.requestId))
      .catch((error: unknown) => {
        this.logger.error(
          { err: error, bookingId: confirmed.id, reference: confirmed.reference },
          'Booking confirmed but the announcement could not be sent',
        );
      });

    return confirmed;
  }

  private toNotification(
    detail: BookingDetail,
    confirmed: Booking,
    requestId?: string,
  ): BookingConfirmedNotification {
    const base = {
      bookingId: confirmed.id,
      reference: confirmed.reference,
      customerName: confirmed.customerName,
      customerEmail: confirmed.customerEmail,
      customerPhone: confirmed.customerPhone,
      totalAmount: confirmed.totalAmount,
      currency: confirmed.currency,
      confirmedAt: confirmed.confirmedAt ?? new Date(),
      cancelUrl: `${this.publicBaseUrl}/bookings/cancel/${confirmed.cancellationToken}`,
      requestId,
    };

    if (confirmed.type === 'ROOM' && confirmed.checkIn && confirmed.checkOut) {
      return {
        ...base,
        type: 'ROOM',
        roomName: detail.roomName ?? 'Room',
        checkIn: confirmed.checkIn,
        checkOut: confirmed.checkOut,
        nights: nightCount({ from: confirmed.checkIn, to: confirmed.checkOut }),
        guests: confirmed.guests,
      };
    }

    return {
      ...base,
      type: 'TOUR',
      tourName: detail.tourName ?? 'Tour',
      departureDate: detail.departureDate ?? confirmed.createdAt,
      seats: confirmed.seats ?? confirmed.guests,
    };
  }
}
