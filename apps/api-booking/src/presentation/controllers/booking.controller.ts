import {
  BOOKING_PATTERNS,
  BookingResponseDto,
  CreateBookingDto,
  CreatePriceRuleDto,
  PriceQuoteResponseDto,
  PriceRuleResponseDto,
  QuotePriceDto,
  ValidationError,
} from '@app/common';
import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  CancelBookingByTokenService,
  CancelBookingService,
  GetBookingByCancellationTokenService,
} from '../../application/usecases/cancel-booking.service';
import { ConfirmBookingService } from '../../application/usecases/confirm-booking.service';
import { CreateBookingService } from '../../application/usecases/create-booking.service';
import {
  GetBookingByReferenceService,
  GetBookingService,
} from '../../application/usecases/get-booking.service';
import {
  CreatePriceRuleService,
  DeletePriceRuleService,
  ListPriceRulesService,
  QuotePriceService,
} from '../../application/usecases/price-rule.service';
import { CreateBookingInput } from '../../domain/usecases/booking.usecase';
import { QuotePriceInput } from '../../domain/usecases/price-rule.usecase';
import { toDateRange, toOptionalUtcDate } from '../utils/payload-dates';

@Controller()
export class BookingController {
  constructor(
    private readonly createBookingService: CreateBookingService,
    private readonly confirmBookingService: ConfirmBookingService,
    private readonly cancelBookingService: CancelBookingService,
    private readonly getBookingService: GetBookingService,
    private readonly getBookingByReferenceService: GetBookingByReferenceService,
    private readonly getBookingByCancellationTokenService: GetBookingByCancellationTokenService,
    private readonly cancelBookingByTokenService: CancelBookingByTokenService,
    private readonly createPriceRuleService: CreatePriceRuleService,
    private readonly listPriceRulesService: ListPriceRulesService,
    private readonly deletePriceRuleService: DeletePriceRuleService,
    private readonly quotePriceService: QuotePriceService,
  ) {}

  // --- Bookings ------------------------------------------------------------

  @MessagePattern(BOOKING_PATTERNS.CREATE_BOOKING)
  async create(
    @Payload() data: CreateBookingDto & { requestId?: string },
  ): Promise<BookingResponseDto> {
    const booking = await this.createBookingService.execute(this.toCreateInput(data));
    return new BookingResponseDto(booking);
  }

  /** Converts the validated wire DTO into a Date-typed domain input. */
  private toCreateInput(data: CreateBookingDto & { requestId?: string }): CreateBookingInput {
    const common = {
      guests: data.guests,
      customer: data.customer,
      notes: data.notes ?? null,
      requestId: data.requestId,
    };

    if (data.type === 'ROOM') {
      if (!data.roomId || !data.checkIn || !data.checkOut) {
        throw new ValidationError('roomId, checkIn and checkOut are required for a room booking');
      }
      return {
        ...common,
        type: 'ROOM',
        roomId: data.roomId,
        range: toDateRange(data.checkIn, data.checkOut),
      };
    }

    if (!data.tourDepartureId || !data.seats) {
      throw new ValidationError('tourDepartureId and seats are required for a tour booking');
    }
    return {
      ...common,
      type: 'TOUR',
      tourDepartureId: data.tourDepartureId,
      seats: data.seats,
    };
  }

  @MessagePattern(BOOKING_PATTERNS.CONFIRM_BOOKING)
  async confirm(
    @Payload() data: { bookingId: number; requestId?: string },
  ): Promise<BookingResponseDto> {
    const booking = await this.confirmBookingService.execute({
      bookingId: data.bookingId,
      requestId: data.requestId,
    });
    return new BookingResponseDto(booking);
  }

  @MessagePattern(BOOKING_PATTERNS.CANCEL_BOOKING)
  async cancel(
    @Payload() data: { bookingId: number; reason?: string; requestId?: string },
  ): Promise<BookingResponseDto> {
    const booking = await this.cancelBookingService.execute({
      bookingId: data.bookingId,
      reason: data.reason ?? null,
      requestId: data.requestId,
    });
    return new BookingResponseDto(booking);
  }

  @MessagePattern(BOOKING_PATTERNS.GET_BOOKING)
  async get(@Payload() data: { id: number }): Promise<BookingResponseDto> {
    const booking = await this.getBookingService.execute(data.id);
    return new BookingResponseDto(booking);
  }

  @MessagePattern(BOOKING_PATTERNS.GET_BOOKING_BY_REFERENCE)
  async getByReference(@Payload() data: { reference: string }): Promise<BookingResponseDto> {
    const booking = await this.getBookingByReferenceService.execute(data.reference);
    return new BookingResponseDto(booking);
  }

  // --- Self-service cancellation -------------------------------------------

  /** Read-only: safe for a mail scanner to prefetch. */
  @MessagePattern(BOOKING_PATTERNS.GET_BOOKING_BY_CANCELLATION_TOKEN)
  async getByCancellationToken(@Payload() data: { token: string }): Promise<BookingResponseDto> {
    const booking = await this.getBookingByCancellationTokenService.execute(data.token);
    return new BookingResponseDto(booking);
  }

  @MessagePattern(BOOKING_PATTERNS.CANCEL_BOOKING_BY_TOKEN)
  async cancelByToken(
    @Payload() data: { token: string; reason?: string; requestId?: string },
  ): Promise<BookingResponseDto> {
    const booking = await this.cancelBookingByTokenService.execute({
      token: data.token,
      reason: data.reason ?? null,
      requestId: data.requestId,
    });
    return new BookingResponseDto(booking);
  }

  // --- Pricing --------------------------------------------------------------

  @MessagePattern(BOOKING_PATTERNS.CREATE_PRICE_RULE)
  async createPriceRule(@Payload() data: CreatePriceRuleDto): Promise<PriceRuleResponseDto> {
    const rule = await this.createPriceRuleService.execute({
      name: data.name,
      roomId: data.roomId ?? null,
      tourId: data.tourId ?? null,
      startDate: toOptionalUtcDate(data.startDate, 'startDate'),
      endDate: toOptionalUtcDate(data.endDate, 'endDate'),
      daysOfWeek: data.daysOfWeek ?? [],
      amount: data.amount,
      priority: data.priority ?? 0,
    });
    return new PriceRuleResponseDto(rule);
  }

  @MessagePattern(BOOKING_PATTERNS.LIST_PRICE_RULES)
  async listPriceRules(
    @Payload() data: { roomId?: number; tourId?: number },
  ): Promise<PriceRuleResponseDto[]> {
    const rules = await this.listPriceRulesService.execute({
      roomId: data.roomId,
      tourId: data.tourId,
    });
    return rules.map((rule) => new PriceRuleResponseDto(rule));
  }

  @MessagePattern(BOOKING_PATTERNS.DELETE_PRICE_RULE)
  async deletePriceRule(@Payload() data: { id: number }): Promise<{ deleted: boolean }> {
    await this.deletePriceRuleService.execute(data.id);
    return { deleted: true };
  }

  @MessagePattern(BOOKING_PATTERNS.QUOTE_PRICE)
  async quote(@Payload() data: QuotePriceDto): Promise<PriceQuoteResponseDto> {
    const quote = await this.quotePriceService.execute(this.toQuoteInput(data));
    return new PriceQuoteResponseDto(quote);
  }

  private toQuoteInput(data: QuotePriceDto): QuotePriceInput {
    if (data.type === 'ROOM') {
      if (!data.roomId || !data.checkIn || !data.checkOut) {
        throw new ValidationError('roomId, checkIn and checkOut are required for a room quote');
      }
      return { type: 'ROOM', roomId: data.roomId, range: toDateRange(data.checkIn, data.checkOut) };
    }

    if (!data.tourDepartureId || !data.seats) {
      throw new ValidationError('tourDepartureId and seats are required for a tour quote');
    }
    return { type: 'TOUR', tourDepartureId: data.tourDepartureId, seats: data.seats };
  }
}
