import {
  BOOKING_PATTERNS,
  BOOKING_SERVICE,
  BookingResponseDto,
  CancelBookingDto,
  CreateBookingDto,
  PriceQuoteResponseDto,
  QuotePriceDto,
} from '@app/common';
import type { CorrelatedRequest } from '@app/common';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';

@Controller('bookings')
export class BookingController {
  constructor(@Inject(BOOKING_SERVICE) private readonly bookingClient: ClientProxy) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Req() req: CorrelatedRequest, @Body() dto: CreateBookingDto) {
    return lastValueFrom(
      this.bookingClient.send<BookingResponseDto>(BOOKING_PATTERNS.CREATE_BOOKING, {
        ...dto,
        requestId: req.requestId,
      }),
    );
  }

  @Post('quote')
  @HttpCode(HttpStatus.OK)
  quote(@Req() req: CorrelatedRequest, @Body() dto: QuotePriceDto) {
    return lastValueFrom(
      this.bookingClient.send<PriceQuoteResponseDto>(BOOKING_PATTERNS.QUOTE_PRICE, {
        ...dto,
        requestId: req.requestId,
      }),
    );
  }

  /**
   * Read-only half of the emailed cancel link.
   *
   * This MUST stay side-effect free: mail clients, corporate scanners and
   * link-preview bots fetch every URL in a message, so a GET that cancelled
   * would cancel bookings nobody ever clicked. The POST below does the work.
   */
  @Get('cancel/:token')
  getByCancellationToken(@Req() req: CorrelatedRequest, @Param('token') token: string) {
    return lastValueFrom(
      this.bookingClient.send<BookingResponseDto>(
        BOOKING_PATTERNS.GET_BOOKING_BY_CANCELLATION_TOKEN,
        { token, requestId: req.requestId },
      ),
    );
  }

  @Post('cancel/:token')
  @HttpCode(HttpStatus.OK)
  cancelByToken(
    @Req() req: CorrelatedRequest,
    @Param('token') token: string,
    @Body() dto: CancelBookingDto,
  ) {
    return lastValueFrom(
      this.bookingClient.send<BookingResponseDto>(BOOKING_PATTERNS.CANCEL_BOOKING_BY_TOKEN, {
        token,
        reason: dto.reason,
        requestId: req.requestId,
      }),
    );
  }

  @Get('reference/:reference')
  getByReference(@Req() req: CorrelatedRequest, @Param('reference') reference: string) {
    return lastValueFrom(
      this.bookingClient.send<BookingResponseDto>(BOOKING_PATTERNS.GET_BOOKING_BY_REFERENCE, {
        reference,
        requestId: req.requestId,
      }),
    );
  }

  @Get(':id')
  get(@Req() req: CorrelatedRequest, @Param('id') id: string) {
    return lastValueFrom(
      this.bookingClient.send<BookingResponseDto>(BOOKING_PATTERNS.GET_BOOKING, {
        id,
        requestId: req.requestId,
      }),
    );
  }

  @Post(':id/confirm')
  @HttpCode(HttpStatus.OK)
  confirm(@Req() req: CorrelatedRequest, @Param('id') id: string) {
    return lastValueFrom(
      this.bookingClient.send<BookingResponseDto>(BOOKING_PATTERNS.CONFIRM_BOOKING, {
        bookingId: id,
        requestId: req.requestId,
      }),
    );
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(@Req() req: CorrelatedRequest, @Param('id') id: string, @Body() dto: CancelBookingDto) {
    return lastValueFrom(
      this.bookingClient.send<BookingResponseDto>(BOOKING_PATTERNS.CANCEL_BOOKING, {
        bookingId: id,
        reason: dto.reason,
        requestId: req.requestId,
      }),
    );
  }
}
