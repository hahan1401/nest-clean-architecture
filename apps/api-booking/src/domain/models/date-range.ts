/**
 * Half-open calendar range: `from` inclusive, `to` exclusive.
 *
 * A stay 2027-02-13 -> 2027-02-16 occupies the nights of the 13th, 14th and
 * 15th, so the next guest may check in on the 16th. This matches the '[)'
 * daterange in the bookings_room_no_overlap exclusion constraint exactly, which
 * is what keeps the availability query and the database invariant in agreement.
 *
 * Both bounds are UTC midnight.
 */
export interface DateRange {
  from: Date;
  to: Date;
}

export const MS_PER_DAY = 86_400_000;

/** UTC midnight of today, for comparing against @db.Date columns. */
export const todayUtc = (now: Date = new Date()): Date =>
  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

/** Nights covered by a half-open range: [from, to). */
export const eachNight = (range: DateRange): Date[] => {
  const nights: Date[] = [];
  for (let time = range.from.getTime(); time < range.to.getTime(); time += MS_PER_DAY) {
    nights.push(new Date(time));
  }
  return nights;
};

export const nightCount = (range: DateRange): number =>
  Math.round((range.to.getTime() - range.from.getTime()) / MS_PER_DAY);
