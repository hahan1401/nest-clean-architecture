import { PriceQuote, Room, Tour, TourDeparture } from '@app/database';
import { Injectable } from '@nestjs/common';
import { DateRange } from '../../domain/models/date-range';
import { PricingPort } from '../../domain/ports/pricing.port';
import { PriceRuleRepository } from '../../domain/repositories/price-rule.repository';
import { quoteRoomStay, quoteTourSeats } from '../../domain/services/price-calculator';

/**
 * Loads the candidate rules and hands them to the pure calculator. The
 * precedence logic lives in the domain because it is business policy; this
 * adapter only knows where the rules are stored.
 */
@Injectable()
export class PriceRulePricingService extends PricingPort {
  constructor(private readonly priceRuleRepository: PriceRuleRepository) {
    super();
  }

  async quoteRoomStay(room: Room, range: DateRange): Promise<PriceQuote> {
    const rules = await this.priceRuleRepository.findForRoom(room.id, range);
    return quoteRoomStay(room.basePrice, rules, range);
  }

  async quoteTourSeats(tour: Tour, departure: TourDeparture, seats: number): Promise<PriceQuote> {
    // Skip the rule lookup entirely when the departure carries an override -
    // it wins outright, so the query would be wasted work.
    const rules =
      departure.priceOverride != null
        ? []
        : await this.priceRuleRepository.findForTour(tour.id, departure.departureDate);

    return quoteTourSeats(
      tour.basePricePerPerson,
      departure.priceOverride,
      rules,
      departure.departureDate,
      seats,
    );
  }
}
