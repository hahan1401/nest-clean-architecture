import type { PriceRule } from '@app/database';
import type { DateRange } from '../models/date-range';

export interface CreatePriceRuleData {
  name: string;
  roomId: number | null;
  tourId: number | null;
  startDate: Date | null;
  endDate: Date | null;
  /** Postgres DOW numbering: 0 = Sunday .. 6 = Saturday. Empty = every day. */
  daysOfWeek: number[];
  amount: number;
  priority: number;
}

export interface PriceRuleFilter {
  roomId?: number;
  tourId?: number;
}

export abstract class PriceRuleRepository {
  abstract create(data: CreatePriceRuleData): Promise<PriceRule>;
  abstract delete(id: number): Promise<void>;
  abstract findById(id: number): Promise<PriceRule | null>;
  abstract findMany(filter: PriceRuleFilter): Promise<PriceRule[]>;

  /** Every active rule that could apply to any day inside `range` for this room. */
  abstract findForRoom(roomId: number, range: DateRange): Promise<PriceRule[]>;

  /** Every active rule that could apply to `on` for this tour. */
  abstract findForTour(tourId: number, on: Date): Promise<PriceRule[]>;
}
