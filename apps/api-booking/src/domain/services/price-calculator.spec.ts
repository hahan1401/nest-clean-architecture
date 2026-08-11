import { PriceRule, PriceSource } from '@app/database';
import { HOUSE_UTC_OFFSET_HOURS, MS_PER_DAY } from '../models/house-clock';
import { quoteRoomStay, quoteTourSeats } from './price-calculator';

/**
 * Every date in this file is an instant on the HOUSE clock, because that is what
 * the columns hold and what the calculator compares. `houseTime('2027-02-13')`
 * is midnight in Da Lat, which is 17:00Z the day before - writing the fixtures
 * any other way tests a night the guest never booked.
 */
const houseTime = (isoDay: string, hour = 0, minute = 0): Date => {
  const [year, month, day] = isoDay.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour - HOUSE_UTC_OFFSET_HOURS, minute));
};

/** The last instant of a house day - how an inclusive rule window closes. */
const endOfHouseDay = (isoDay: string): Date =>
  new Date(houseTime(isoDay).getTime() + MS_PER_DAY - 1);

/** Reads an instant back as the house day it falls in: `"2027-02-13"`. */
const houseDayOf = (instant: Date): string =>
  new Date(instant.getTime() + HOUSE_UTC_OFFSET_HOURS * 3_600_000).toISOString().slice(0, 10);

const rule = (partial: Partial<PriceRule>): PriceRule =>
  new PriceRule({
    id: 1,
    name: 'rule',
    roomId: 1,
    tourId: null,
    startDate: null,
    endDate: null,
    daysOfWeek: [],
    amount: 0,
    priority: 0,
    isActive: true,
    createdAt: houseTime('2026-01-01'),
    updatedAt: houseTime('2026-01-01'),
    ...partial,
  });

/** The site's defaults: arrive at 13:00, leave at 11:00, house time. */
const stay = (fromDay: string, toDay: string) => ({
  from: houseTime(fromDay, 13),
  to: houseTime(toDay, 11),
});

describe('quoteRoomStay', () => {
  it('charges one line per night and never the checkout day', () => {
    const quote = quoteRoomStay(100, [], stay('2027-02-13', '2027-02-16'));

    expect(quote.lines).toHaveLength(3);
    expect(quote.lines.map((line) => houseDayOf(line.date))).toEqual([
      '2027-02-13',
      '2027-02-14',
      '2027-02-15',
    ]);
    expect(quote.total).toBe(300);
  });

  it('prices the nights crossed, not the hours stayed', () => {
    // A late arrival and an early departure is still two nights, and two nights
    // is what a guest is charged. The hours only move the occupancy window.
    const quote = quoteRoomStay(100, [], {
      from: houseTime('2027-02-13', 23, 30),
      to: houseTime('2027-02-15', 6),
    });

    expect(quote.lines).toHaveLength(2);
    expect(quote.total).toBe(200);
  });

  it('falls back to the base price when no rule matches', () => {
    const quote = quoteRoomStay(650_000, [], stay('2027-05-01', '2027-05-02'));

    expect(quote.lines[0].unitAmount).toBe(650_000);
    expect(quote.lines[0].source).toBe(PriceSource.BASE);
    expect(quote.lines[0].priceRuleId).toBeNull();
  });

  it('applies a date-window rule only inside its window', () => {
    const tet = rule({
      id: 2,
      startDate: houseTime('2027-02-14'),
      endDate: endOfHouseDay('2027-02-20'),
      amount: 1_600_000,
      priority: 100,
    });

    const quote = quoteRoomStay(650_000, [tet], stay('2027-02-13', '2027-02-16'));

    expect(quote.lines.map((line) => line.unitAmount)).toEqual([650_000, 1_600_000, 1_600_000]);
    expect(quote.total).toBe(650_000 + 1_600_000 * 2);
    expect(quote.lines[1].source).toBe(PriceSource.RULE);
    expect(quote.lines[1].priceRuleId).toBe(2);
  });

  it('matches days of week using Postgres DOW numbering read on the house clock', () => {
    // 2027-02-13 is a Saturday (DOW 6), 2027-02-14 a Sunday (DOW 0). The night of
    // the 13th begins at 17:00Z on the 12th, so reading the weekday in UTC would
    // call it a Friday and price the wrong night.
    const weekend = rule({ id: 3, daysOfWeek: [5, 6], amount: 850_000 });

    const quote = quoteRoomStay(650_000, [weekend], stay('2027-02-13', '2027-02-15'));

    expect(quote.lines.map((line) => line.unitAmount)).toEqual([850_000, 650_000]);
  });

  it('lets the higher priority rule win when two rules both match', () => {
    const weekend = rule({ id: 3, daysOfWeek: [5, 6], amount: 850_000, priority: 10 });
    const tet = rule({
      id: 2,
      startDate: houseTime('2027-02-13'),
      endDate: endOfHouseDay('2027-02-20'),
      amount: 1_600_000,
      priority: 100,
    });

    const quote = quoteRoomStay(650_000, [weekend, tet], stay('2027-02-13', '2027-02-14'));

    expect(quote.lines[0].unitAmount).toBe(1_600_000);
    expect(quote.lines[0].priceRuleId).toBe(2);
  });

  it('prefers the narrower window when priority and specificity tie', () => {
    const season = rule({
      id: 4,
      startDate: houseTime('2027-01-01'),
      endDate: endOfHouseDay('2027-03-31'),
      amount: 800_000,
    });
    const holiday = rule({
      id: 5,
      startDate: houseTime('2027-02-13'),
      endDate: endOfHouseDay('2027-02-15'),
      amount: 1_200_000,
    });

    const quote = quoteRoomStay(650_000, [season, holiday], stay('2027-02-14', '2027-02-15'));

    expect(quote.lines[0].priceRuleId).toBe(5);
  });

  it('ignores inactive rules', () => {
    const disabled = rule({ id: 6, amount: 999_999, isActive: false });

    const quote = quoteRoomStay(650_000, [disabled], stay('2027-05-01', '2027-05-02'));

    expect(quote.lines[0].unitAmount).toBe(650_000);
  });

  it('produces no lines when arrival and departure share a house day', () => {
    const quote = quoteRoomStay(650_000, [], {
      from: houseTime('2027-05-01', 9),
      to: houseTime('2027-05-01', 20),
    });

    expect(quote.lines).toHaveLength(0);
    expect(quote.total).toBe(0);
  });
});

describe('quoteTourSeats', () => {
  it('multiplies the per-person price by the seat count', () => {
    const quote = quoteTourSeats(450_000, null, [], houseTime('2027-03-06', 7, 10), 3);

    expect(quote.lines).toHaveLength(1);
    expect(quote.lines[0].quantity).toBe(3);
    expect(quote.lines[0].unitAmount).toBe(450_000);
    expect(quote.total).toBe(1_350_000);
    expect(quote.lines[0].source).toBe(PriceSource.BASE);
  });

  it('lets a departure override beat an otherwise matching rule', () => {
    const tet = rule({
      id: 7,
      roomId: null,
      tourId: 1,
      startDate: houseTime('2027-02-14'),
      endDate: endOfHouseDay('2027-02-20'),
      amount: 550_000,
      priority: 100,
    });

    const quote = quoteTourSeats(450_000, 600_000, [tet], houseTime('2027-02-15', 7, 10), 2);

    expect(quote.lines[0].unitAmount).toBe(600_000);
    expect(quote.lines[0].source).toBe(PriceSource.DEPARTURE_OVERRIDE);
    expect(quote.lines[0].priceRuleId).toBeNull();
    expect(quote.total).toBe(1_200_000);
  });

  it('uses a matching rule when there is no departure override', () => {
    const tet = rule({
      id: 7,
      roomId: null,
      tourId: 1,
      startDate: houseTime('2027-02-14'),
      endDate: endOfHouseDay('2027-02-20'),
      amount: 550_000,
      priority: 100,
    });

    const quote = quoteTourSeats(450_000, null, [tet], houseTime('2027-02-15', 7, 10), 2);

    expect(quote.lines[0].unitAmount).toBe(550_000);
    expect(quote.lines[0].source).toBe(PriceSource.RULE);
    expect(quote.total).toBe(1_100_000);
  });

  it('matches a rule window against the departure instant, including the last day', () => {
    // A 07:10 departure on the closing day of the window is still inside it,
    // because the window closes at the last instant of that house day.
    const tet = rule({
      id: 8,
      roomId: null,
      tourId: 1,
      startDate: houseTime('2027-02-14'),
      endDate: endOfHouseDay('2027-02-20'),
      amount: 550_000,
      priority: 100,
    });

    const quote = quoteTourSeats(450_000, null, [tet], houseTime('2027-02-20', 7, 10), 1);

    expect(quote.lines[0].source).toBe(PriceSource.RULE);
  });
});
