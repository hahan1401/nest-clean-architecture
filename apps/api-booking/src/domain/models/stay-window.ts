import type { DateRange } from './date-range';

/**
 * The house clock, on the ridge above Da Lat.
 *
 * A stay is chosen as calendar dates but occupies the room from 13:00 on the
 * arrival day until 11:00 on the departure day. The two-hour gap is what lets
 * one guest leave and another arrive the same day - under date-only storage
 * those two bookings overlapped and the exclusion constraint refused the second.
 *
 * These are HOUSE hours, not UTC ones. Vietnam is UTC+7 year round and has no
 * daylight saving, so a fixed offset is exact rather than a simplification -
 * which is why this is arithmetic and not a timezone library. Stored instants
 * are UTC: 13:00 on the ridge is 06:00Z.
 */
export const HOUSE_CHECK_IN_HOUR = 13;
export const HOUSE_CHECK_OUT_HOUR = 11;
export const HOUSE_UTC_OFFSET_HOURS = 7;

const atHouseHour = (day: Date, hour: number): Date =>
  new Date(
    Date.UTC(
      day.getUTCFullYear(),
      day.getUTCMonth(),
      day.getUTCDate(),
      hour - HOUSE_UTC_OFFSET_HOURS,
    ),
  );

/**
 * Calendar dates -> the instants the room is actually held.
 *
 * This is the only place the house times are applied. Everything upstream -
 * quotes, price rules, night counts - keeps working in calendar dates, because
 * money is still per night and a night is still a calendar night.
 */
export const toStayWindow = (range: DateRange): DateRange => ({
  from: atHouseHour(range.from, HOUSE_CHECK_IN_HOUR),
  to: atHouseHour(range.to, HOUSE_CHECK_OUT_HOUR),
});

/**
 * The inverse, for a stay read back out of the database: the calendar dates the
 * guest originally picked. The instant is shifted onto the house clock before
 * being truncated, because 06:00Z is already the 13th on the ridge.
 */
export const toCalendarRange = (window: DateRange): DateRange => {
  const houseDay = (instant: Date): Date => {
    const local = new Date(instant.getTime() + HOUSE_UTC_OFFSET_HOURS * 3_600_000);
    return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()));
  };
  return { from: houseDay(window.from), to: houseDay(window.to) };
};
