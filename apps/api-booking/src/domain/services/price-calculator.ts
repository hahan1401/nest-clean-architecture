import { PriceQuote, PriceQuoteLine, PriceRule, PriceSource } from '@app/database';
import { DateRange, MS_PER_DAY, eachNight } from '../models/date-range';
import { houseWeekday } from '../models/house-clock';

/**
 * Does this rule apply on this particular night?
 *
 * `day` is the instant the night begins on the house clock, and the window
 * bounds are instants too, so both comparisons are straight instant tests.
 *
 * The weekday is read on the HOUSE clock, in Postgres DOW numbering
 * (0 = Sunday .. 6 = Saturday), which is what PriceRule.daysOfWeek stores. It
 * has to be: a night beginning at 17:00Z is already the next day on the ridge,
 * so a "Saturday" rule read in UTC would price the wrong nights.
 */
const matches = (rule: PriceRule, day: Date): boolean =>
  rule.isActive &&
  (rule.startDate == null || day >= rule.startDate) &&
  (rule.endDate == null || day <= rule.endDate) &&
  (rule.daysOfWeek.length === 0 || rule.daysOfWeek.includes(houseWeekday(day)));

/** How narrowly a rule is targeted: bounded dates and a weekday filter each count. */
const specificity = (rule: PriceRule): number =>
  (rule.startDate ? 1 : 0) + (rule.endDate ? 1 : 0) + (rule.daysOfWeek.length > 0 ? 1 : 0);

const windowDays = (rule: PriceRule): number =>
  rule.startDate && rule.endDate
    ? (rule.endDate.getTime() - rule.startDate.getTime()) / MS_PER_DAY
    : Number.POSITIVE_INFINITY;

/**
 * A total order over rules, most significant first:
 *   1. explicit `priority` - the admin-controlled lever
 *   2. specificity - a Tet window beats an open-ended weekend rule
 *   3. narrower window - a 7-day rule beats a 3-month season
 *   4. newest, then id - a final tie-break so the winner is never ambiguous
 *
 * Determinism matters more than cleverness here: the resolved price is frozen
 * onto the booking, so the same inputs must always produce the same money.
 */
const compareRules = (a: PriceRule, b: PriceRule): number =>
  b.priority - a.priority ||
  specificity(b) - specificity(a) ||
  windowDays(a) - windowDays(b) ||
  b.createdAt.getTime() - a.createdAt.getTime() ||
  (a.id < b.id ? 1 : a.id > b.id ? -1 : 0);

const winningRule = (rules: PriceRule[], day: Date): PriceRule | undefined =>
  rules.filter((rule) => matches(rule, day)).sort(compareRules)[0];

const lineFor = (
  date: Date,
  quantity: number,
  unitAmount: number,
  source: PriceSource,
  priceRuleId: number | null,
): PriceQuoteLine =>
  new PriceQuoteLine({
    date,
    quantity,
    unitAmount,
    amount: unitAmount * quantity,
    source,
    priceRuleId,
  });

const quoteOf = (lines: PriceQuoteLine[], currency: string): PriceQuote =>
  new PriceQuote({
    currency,
    lines,
    total: lines.reduce((sum, line) => sum + line.amount, 0),
  });

/** One line per stay night; the checkout day is not charged. */
export const quoteRoomStay = (
  basePrice: number,
  rules: PriceRule[],
  range: DateRange,
  currency = 'VND',
): PriceQuote => {
  const lines = eachNight(range).map((date) => {
    const rule = winningRule(rules, date);
    return lineFor(
      date,
      1,
      rule?.amount ?? basePrice,
      rule ? PriceSource.RULE : PriceSource.BASE,
      rule?.id ?? null,
    );
  });

  return quoteOf(lines, currency);
};

/**
 * A tour collapses to a single line of `seats` units.
 *
 * Precedence is departure override -> price rule -> tour base price. An override
 * is an admin pricing that exact departure by hand, which is more specific than
 * any rule could be, so it wins outright.
 */
export const quoteTourSeats = (
  basePricePerPerson: number,
  priceOverride: number | null | undefined,
  rules: PriceRule[],
  departureDate: Date,
  seats: number,
  currency = 'VND',
): PriceQuote => {
  if (priceOverride != null) {
    return quoteOf(
      [lineFor(departureDate, seats, priceOverride, PriceSource.DEPARTURE_OVERRIDE, null)],
      currency,
    );
  }

  const rule = winningRule(rules, departureDate);
  return quoteOf(
    [
      lineFor(
        departureDate,
        seats,
        rule?.amount ?? basePricePerPerson,
        rule ? PriceSource.RULE : PriceSource.BASE,
        rule?.id ?? null,
      ),
    ],
    currency,
  );
};
