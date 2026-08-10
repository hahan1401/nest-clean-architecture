import {
  BOOKING_PATTERNS,
  BOOKING_SERVICE,
  CreatePriceRuleDto,
  PriceRuleListQueryDto,
  PriceRuleResponseDto,
} from '@app/common';
import type { CorrelatedRequest } from '@app/common';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';

@Controller('price-rules')
export class PriceRuleController {
  constructor(@Inject(BOOKING_SERVICE) private readonly bookingClient: ClientProxy) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Req() req: CorrelatedRequest, @Body() dto: CreatePriceRuleDto) {
    return lastValueFrom(
      this.bookingClient.send<PriceRuleResponseDto>(BOOKING_PATTERNS.CREATE_PRICE_RULE, {
        ...dto,
        requestId: req.requestId,
      }),
    );
  }

  @Get()
  list(@Req() req: CorrelatedRequest, @Query() query: PriceRuleListQueryDto) {
    return lastValueFrom(
      this.bookingClient.send<PriceRuleResponseDto[]>(BOOKING_PATTERNS.LIST_PRICE_RULES, {
        ...query,
        requestId: req.requestId,
      }),
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Req() req: CorrelatedRequest,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    await lastValueFrom(
      this.bookingClient.send<{ deleted: boolean }>(BOOKING_PATTERNS.DELETE_PRICE_RULE, {
        id,
        requestId: req.requestId,
      }),
    );
  }
}
