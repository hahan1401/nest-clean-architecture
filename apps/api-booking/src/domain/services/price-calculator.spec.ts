import { PriceRule, PriceSource } from '@app/database';
import { quoteRoomStay, quoteTourSeats } from './price-calculator';

const day = (iso: string): Date => new Date(iso);

const rule = (partial: Partial<PriceRule>): PriceRule =>
  new PriceRule({
    id: 'rule-1',
    name: 'rule',
    roomId: 'room-1',
    tourId: null,
    startDate: null,
    endDate: null,
    daysOfWeek: [],
    amount: 0,
    priority: 0,
    isActive: true,
    createdAt: day('2026-01-01'),
    updatedAt: day('2026-01-01'),
    ...partial,
  });

describe('quoteRoomStay', () => {
  it('charges one line per night and never the checkout day', () => {
    const quote = quoteRoomStay(100, [], { from: day('2027-02-13'), to: day('2027-02-16') });

    expect(quote.lines).toHaveLength(3);
    expect(quote.lines.map((line) => line.date.toISOString().slice(0, 10))).toEqual([
      '2027-02-13',
      '2027-02-14',
      '2027-02-15',
    ]);
    expect(quote.total).toBe(300);
  });

  it('falls back to the base price when no rule matches', () => {
    const quote = quoteRoomStay(650_000, [], { from: day('2027-05-01'), to: day('2027-05-02') });

    expect(quote.lines[0].unitAmount).toBe(650_000);
    expect(quote.lines[0].source).toBe(PriceSource.BASE);
    expect(quote.lines[0].priceRuleId).toBeNull();
  });

  it('applies a date-window rule only inside its window', () => {
    const tet = rule({
      id: 'tet',
      startDate: day('2027-02-14'),
      endDate: day('2027-02-20'),
      amount: 1_600_000,
      priority: 100,
    });

    const quote = quoteRoomStay(650_000, [tet], {
      from: day('2027-02-13'),
      to: day('2027-02-16'),
    });

    expect(quote.lines.map((line) => line.unitAmount)).toEqual([650_000, 1_600_000, 1_600_000]);
    expect(quote.total).toBe(650_000 + 1_600_000 * 2);
    expect(quote.lines[1].source).toBe(PriceSource.RULE);
    expect(quote.lines[1].priceRuleId).toBe('tet');
  });

  it('matches days of week using Postgres DOW numbering read in UTC', () => {
    // 2027-02-13 is a Saturday (DOW 6), 2027-02-14 a Sunday (DOW 0).
    const weekend = rule({ id: 'weekend', daysOfWeek: [5, 6], amount: 850_000 });

    const quote = quoteRoomStay(650_000, [weekend], {
      from: day('2027-02-13'),
      to: day('2027-02-15'),
    });

    expect(quote.lines.map((line) => line.unitAmount)).toEqual([850_000, 650_000]);
  });

  it('lets the higher priority rule win when two rules both match', () => {
    const weekend = rule({ id: 'weekend', daysOfWeek: [5, 6], amount: 850_000, priority: 10 });
    const tet = rule({
      id: 'tet',
      startDate: day('2027-02-13'),
      endDate: day('2027-02-20'),
      amount: 1_600_000,
      priority: 100,
    });

    const quote = quoteRoomStay(650_000, [weekend, tet], {
      from: day('2027-02-13'),
      to: day('2027-02-14'),
    });

    expect(quote.lines[0].unitAmount).toBe(1_600_000);
    expect(quote.lines[0].priceRuleId).toBe('tet');
  });

  it('prefers the narrower window when priority and specificity tie', () => {
    const season = rule({
      id: 'season',
      startDate: day('2027-01-01'),
      endDate: day('2027-03-31'),
      amount: 800_000,
    });
    const holiday = rule({
      id: 'holiday',
      startDate: day('2027-02-13'),
      endDate: day('2027-02-15'),
      amount: 1_200_000,
    });

    const quote = quoteRoomStay(650_000, [season, holiday], {
      from: day('2027-02-14'),
      to: day('2027-02-15'),
    });

    expect(quote.lines[0].priceRuleId).toBe('holiday');
  });

  it('ignores inactive rules', () => {
    const disabled = rule({ id: 'off', amount: 999_999, isActive: false });

    const quote = quoteRoomStay(650_000, [disabled], {
      from: day('2027-05-01'),
      to: day('2027-05-02'),
    });

    expect(quote.lines[0].unitAmount).toBe(650_000);
  });

  it('produces no lines for a zero-night range', () => {
    const quote = quoteRoomStay(650_000, [], { from: day('2027-05-01'), to: day('2027-05-01') });

    expect(quote.lines).toHaveLength(0);
    expect(quote.total).toBe(0);
  });
});

describe('quoteTourSeats', () => {
  it('multiplies the per-person price by the seat count', () => {
    const quote = quoteTourSeats(450_000, null, [], day('2027-03-06'), 3);

    expect(quote.lines).toHaveLength(1);
    expect(quote.lines[0].quantity).toBe(3);
    expect(quote.lines[0].unitAmount).toBe(450_000);
    expect(quote.total).toBe(1_350_000);
    expect(quote.lines[0].source).toBe(PriceSource.BASE);
  });

  it('lets a departure override beat an otherwise matching rule', () => {
    const tet = rule({
      id: 'tet-tour',
      roomId: null,
      tourId: 'tour-1',
      startDate: day('2027-02-14'),
      endDate: day('2027-02-20'),
      amount: 550_000,
      priority: 100,
    });

    const quote = quoteTourSeats(450_000, 600_000, [tet], day('2027-02-15'), 2);

    expect(quote.lines[0].unitAmount).toBe(600_000);
    expect(quote.lines[0].source).toBe(PriceSource.DEPARTURE_OVERRIDE);
    expect(quote.lines[0].priceRuleId).toBeNull();
    expect(quote.total).toBe(1_200_000);
  });

  it('uses a matching rule when there is no departure override', () => {
    const tet = rule({
      id: 'tet-tour',
      roomId: null,
      tourId: 'tour-1',
      startDate: day('2027-02-14'),
      endDate: day('2027-02-20'),
      amount: 550_000,
      priority: 100,
    });

    const quote = quoteTourSeats(450_000, null, [tet], day('2027-02-15'), 2);

    expect(quote.lines[0].unitAmount).toBe(550_000);
    expect(quote.lines[0].source).toBe(PriceSource.RULE);
    expect(quote.total).toBe(1_100_000);
  });
});
