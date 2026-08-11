import { MS_PER_DAY, houseDayIndex, houseDayStart } from './house-clock';

export { MS_PER_DAY };

/**
 * Half-open range of instants: `from` inclusive, `to` exclusive.
 *
 * A stay arriving 2027-02-13 13:00 and leaving 2027-02-16 11:00 occupies the
 * nights of the 13th, 14th and 15th, so the next guest may arrive on the 16th.
 * This matches the '[)' tstzrange in the bookings_room_no_overlap exclusion
 * constraint exactly, which is what keeps the availability query and the
 * database invariant in agreement.
 *
 * Both bounds are instants, picked by the guest. Nothing here assumes midnight,
 * and nothing here assumes a particular hour - the site defaults to 13:00 and
 * 11:00 on the house clock, but the domain never imposes them.
 */
export interface DateRange {
  from: Date;
  to: Date;
}

/**
 * Nights covered by a half-open range, each as the instant that night begins on
 * the house clock.
 *
 * Counted in house days, not by dividing the elapsed milliseconds: 13:00 on the
 * 14th to 09:00 on the 16th is two nights even though it is only 44 hours, and
 * that is what the guest is charged for. Money stays per calendar night; the
 * hours only ever move the occupancy window.
 */
export const eachNight = (range: DateRange): Date[] => {
  const first = houseDayStart(range.from).getTime();
  const nights: Date[] = [];
  for (let night = 0, total = nightCount(range); night < total; night += 1) {
    nights.push(new Date(first + night * MS_PER_DAY));
  }
  return nights;
};

export const nightCount = (range: DateRange): number =>
  houseDayIndex(range.to) - houseDayIndex(range.from);
