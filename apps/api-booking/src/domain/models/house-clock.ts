/**
 * The house clock, on the ridge above Da Lat.
 *
 * Every temporal column in this system is a `timestamptz` - an instant. Nothing
 * stored anywhere is a calendar day. But a *night* is a human idea, and humans
 * on the ridge count nights on their own clock: the night of the 14th begins at
 * 00:00 in Da Lat, not at 00:00Z. This module is the only place that idea is
 * expressed, and everything that has to turn an instant into "which day is
 * that?" - night counting, price-rule weekdays, "not in the past" - goes
 * through it.
 *
 * Vietnam is UTC+7 year round and has no daylight saving, so a fixed offset is
 * exact rather than a simplification. That is why this is arithmetic and not a
 * timezone library, and why the same three lines can live unchanged in the
 * frontend and in the email templates.
 */
export const HOUSE_UTC_OFFSET_HOURS = 7;

export const MS_PER_DAY = 86_400_000;

const HOUSE_OFFSET_MS = HOUSE_UTC_OFFSET_HOURS * 3_600_000;

/**
 * Which house day an instant falls in, as a whole number of days since the
 * epoch. The primitive underneath everything else here: two instants are the
 * same night when their indexes match, and the nights between them is the
 * difference.
 */
export const houseDayIndex = (instant: Date): number =>
  Math.floor((instant.getTime() + HOUSE_OFFSET_MS) / MS_PER_DAY);

/** The instant 00:00 house time begins on the day containing `instant`. */
export const houseDayStart = (instant: Date): Date =>
  new Date(houseDayIndex(instant) * MS_PER_DAY - HOUSE_OFFSET_MS);

/**
 * Weekday of the house day containing `instant`, in Postgres DOW numbering
 * (0 = Sunday .. 6 = Saturday), so a rule's `daysOfWeek` means what an operator
 * standing at the house would mean. Reading `getUTCDay()` directly is wrong from
 * 17:00Z onwards, which is already tomorrow on the ridge.
 */
export const houseWeekday = (instant: Date): number =>
  new Date(instant.getTime() + HOUSE_OFFSET_MS).getUTCDay();

/**
 * The instant today began on the house clock. Replaces the old `todayUtc()`:
 * the crons fire on server local time but must decide "has this day passed?"
 * the way the house would, and in a UTC+7 deployment those disagreed by seven
 * hours in the direction that closed departures a day early.
 */
export const nowHouseDayStart = (now: Date = new Date()): Date => houseDayStart(now);

/** How the house writes a moment: the same `DD/MM/YYYY HH:mm` the guest picked. */
export const HOUSE_ZONE_LABEL = 'GMT+7';

const pad = (value: number): string => String(value).padStart(2, '0');

/**
 * An instant rendered on the house clock, e.g. `"14/02/2027 15:00"`.
 *
 * Shifting into the offset and then reading the UTC fields is what makes this
 * independent of the server's own timezone: the same string comes out of a
 * container in Frankfurt as out of one in Singapore. Anywhere this is shown to
 * someone who did not pick it, pair it with HOUSE_ZONE_LABEL.
 */
export const houseMoment = (instant: Date): string => {
  const local = new Date(instant.getTime() + HOUSE_OFFSET_MS);
  return (
    `${pad(local.getUTCDate())}/${pad(local.getUTCMonth() + 1)}/${local.getUTCFullYear()}` +
    ` ${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`
  );
};
