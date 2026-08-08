import type { PriceQuote, PriceRule } from '@app/database';
import type { DateRange } from '../models/date-range';
import type { CreatePriceRuleData, PriceRuleFilter } from '../repositories/price-rule.repository';

export interface CreatePriceRuleUseCase {
  execute(data: CreatePriceRuleData): Promise<PriceRule>;
}

export interface ListPriceRulesUseCase {
  execute(filter: PriceRuleFilter): Promise<PriceRule[]>;
}

export interface DeletePriceRuleUseCase {
  execute(id: string): Promise<void>;
}

export type QuotePriceInput =
  | { type: 'ROOM'; roomId: string; range: DateRange }
  | { type: 'TOUR'; tourDepartureId: string; seats: number };

export interface QuotePriceUseCase {
  execute(input: QuotePriceInput): Promise<PriceQuote>;
}
