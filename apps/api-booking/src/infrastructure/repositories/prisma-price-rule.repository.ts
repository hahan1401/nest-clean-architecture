import { PRISMA_SERVICE, PriceRule, type ExtendedPrismaClient } from '@app/database';
import { Inject, Injectable } from '@nestjs/common';
import { DateRange } from '../../domain/models/date-range';
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

  async delete(id: string): Promise<void> {
    await this.prisma.priceRule.delete({ where: { id } });
  }

  async findById(id: string): Promise<PriceRule | null> {
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
   * Candidate rules for a stay: anything whose window intersects [from, to).
   * A NULL bound means unbounded on that side, so it always intersects.
   * The final precedence decision is the pure comparator in the domain layer -
   * this only narrows the set.
   */
  async findForRoom(roomId: string, range: DateRange): Promise<PriceRule[]> {
    const lastNight = new Date(range.to.getTime() - 86_400_000);

    const rules = await this.prisma.priceRule.findMany({
      where: {
        roomId,
        isActive: true,
        AND: [
          { OR: [{ startDate: null }, { startDate: { lte: lastNight } }] },
          { OR: [{ endDate: null }, { endDate: { gte: range.from } }] },
        ],
      },
    });
    return rules.map((rule) => new PriceRule(rule));
  }

  async findForTour(tourId: string, on: Date): Promise<PriceRule[]> {
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
