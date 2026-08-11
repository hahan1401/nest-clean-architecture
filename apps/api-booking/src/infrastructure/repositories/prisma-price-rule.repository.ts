import { PRISMA_SERVICE, PriceRule, type ExtendedPrismaClient } from '@app/database';
import { Inject, Injectable } from '@nestjs/common';
import { DateRange } from '../../domain/models/date-range';
import { MS_PER_DAY, houseDayStart } from '../../domain/models/house-clock';
import {
  CreatePriceRuleData,
  PriceRuleFilter,
  PriceRuleRepository,
} from '../../domain/repositories/price-rule.repository';

@Injectable()
export class PrismaPriceRuleRepository extends PriceRuleRepository {
  constructor(@Inject(PRISMA_SERVICE) private readonly prisma: ExtendedPrismaClient) {
    super();
  }

  async create(data: CreatePriceRuleData): Promise<PriceRule> {
    const rule = await this.prisma.priceRule.create({ data });
    return new PriceRule(rule);
  }

  async delete(id: number): Promise<void> {
    await this.prisma.priceRule.delete({ where: { id } });
  }

  async findById(id: number): Promise<PriceRule | null> {
    const rule = await this.prisma.priceRule.findUnique({ where: { id } });
    return rule ? new PriceRule(rule) : null;
  }

  async findMany(filter: PriceRuleFilter): Promise<PriceRule[]> {
    const rules = await this.prisma.priceRule.findMany({
      where: { roomId: filter.roomId, tourId: filter.tourId },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });
    return rules.map((rule) => new PriceRule(rule));
  }

  /**
   * Candidate rules for a stay: anything whose window intersects the nights
   * being priced. A NULL bound means unbounded on that side, so it always
   * intersects. The final precedence decision is the pure comparator in the
   * domain layer - this only narrows the set.
   *
   * Both bounds are NIGHTS, not the arrival and checkout instants: the domain
   * matcher compares a rule's window against the instant a night *begins* on the
   * house clock, so narrowing on the raw instants would drop rules the matcher
   * would have applied - a rule ending at 07:00 on the arrival day still covers
   * that night, which began at 00:00. The checkout day is never billed, so the
   * upper bound is the day before it.
   */
  async findForRoom(roomId: number, range: DateRange): Promise<PriceRule[]> {
    const firstNight = houseDayStart(range.from);
    const lastNight = new Date(houseDayStart(range.to).getTime() - MS_PER_DAY);

    const rules = await this.prisma.priceRule.findMany({
      where: {
        roomId,
        isActive: true,
        AND: [
          { OR: [{ startDate: null }, { startDate: { lte: lastNight } }] },
          { OR: [{ endDate: null }, { endDate: { gte: firstNight } }] },
        ],
      },
    });
    return rules.map((rule) => new PriceRule(rule));
  }

  async findForTour(tourId: number, on: Date): Promise<PriceRule[]> {
    const rules = await this.prisma.priceRule.findMany({
      where: {
        tourId,
        isActive: true,
        AND: [
          { OR: [{ startDate: null }, { startDate: { lte: on } }] },
          { OR: [{ endDate: null }, { endDate: { gte: on } }] },
        ],
      },
    });
    return rules.map((rule) => new PriceRule(rule));
  }
}
