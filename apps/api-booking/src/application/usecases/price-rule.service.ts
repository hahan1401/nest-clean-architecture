import { NotFoundError, ValidationError } from '@app/common';
import { PriceQuote, PriceRule } from '@app/database';
import { Injectable } from '@nestjs/common';
import { PricingPort } from '../../domain/ports/pricing.port';
import {
  CreatePriceRuleData,
  PriceRuleFilter,
  PriceRuleRepository,
} from '../../domain/repositories/price-rule.repository';
import { RoomRepository } from '../../domain/repositories/room.repository';
import { TourDepartureRepository } from '../../domain/repositories/tour-departure.repository';
import { TourRepository } from '../../domain/repositories/tour.repository';
import {
  CreatePriceRuleUseCase,
  DeletePriceRuleUseCase,
  ListPriceRulesUseCase,
  QuotePriceInput,
  QuotePriceUseCase,
} from '../../domain/usecases/price-rule.usecase';
import { assertUsableRange } from './room.service';

@Injectable()
export class CreatePriceRuleService implements CreatePriceRuleUseCase {
  constructor(
    private readonly priceRuleRepository: PriceRuleRepository,
    private readonly roomRepository: RoomRepository,
    private readonly tourRepository: TourRepository,
  ) {}

  async execute(data: CreatePriceRuleData): Promise<PriceRule> {
    // Mirrors price_rules_target_check, so a bad request fails as a 400 here
    // rather than surfacing as an opaque constraint violation from Postgres.
    if ((data.roomId == null) === (data.tourId == null)) {
      throw new ValidationError('Exactly one of roomId or tourId must be set');
    }
    if (data.startDate && data.endDate && data.endDate < data.startDate) {
      throw new ValidationError('endDate must not be before startDate');
    }
    if (data.daysOfWeek.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) {
      throw new ValidationError('daysOfWeek must contain integers between 0 (Sunday) and 6');
    }

    if (data.roomId != null) {
      const room = await this.roomRepository.findById(data.roomId);
      if (!room) {
        throw new NotFoundError(`Room with id ${data.roomId} not found`);
      }
    } else if (data.tourId != null) {
      const tour = await this.tourRepository.findById(data.tourId);
      if (!tour) {
        throw new NotFoundError(`Tour with id ${data.tourId} not found`);
      }
    }

    return this.priceRuleRepository.create(data);
  }
}

@Injectable()
export class ListPriceRulesService implements ListPriceRulesUseCase {
  constructor(private readonly priceRuleRepository: PriceRuleRepository) {}

  execute(filter: PriceRuleFilter): Promise<PriceRule[]> {
    return this.priceRuleRepository.findMany(filter);
  }
}

@Injectable()
export class DeletePriceRuleService implements DeletePriceRuleUseCase {
  constructor(private readonly priceRuleRepository: PriceRuleRepository) {}

  async execute(id: string): Promise<void> {
    const rule = await this.priceRuleRepository.findById(id);
    if (!rule) {
      throw new NotFoundError(`Price rule with id ${id} not found`);
    }
    // Booking lines reference the rule with ON DELETE SET NULL, so history keeps
    // its frozen amounts and merely loses the "why".
    await this.priceRuleRepository.delete(id);
  }
}

@Injectable()
export class QuotePriceService implements QuotePriceUseCase {
  constructor(
    private readonly roomRepository: RoomRepository,
    private readonly tourRepository: TourRepository,
    private readonly departureRepository: TourDepartureRepository,
    private readonly pricing: PricingPort,
  ) {}

  async execute(input: QuotePriceInput): Promise<PriceQuote> {
    if (input.type === 'ROOM') {
      assertUsableRange(input.range);
      const room = await this.roomRepository.findById(input.roomId);
      if (!room) {
        throw new NotFoundError(`Room with id ${input.roomId} not found`);
      }
      return this.pricing.quoteRoomStay(room, input.range);
    }

    if (input.seats < 1) {
      throw new ValidationError('seats must be at least 1');
    }

    const departure = await this.departureRepository.findById(input.tourDepartureId);
    if (!departure) {
      throw new NotFoundError(`Tour departure with id ${input.tourDepartureId} not found`);
    }
    const tour = await this.tourRepository.findById(departure.tourId);
    if (!tour) {
      throw new NotFoundError(`Tour with id ${departure.tourId} not found`);
    }

    return this.pricing.quoteTourSeats(tour, departure, input.seats);
  }
}
