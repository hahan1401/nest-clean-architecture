import { MS_PER_DAY, houseDayIndex, houseDayStart } from './house-clock';

export { MS_PER_DAY };

/**
 * Half-open range of instants: `from` inclusive, `to` exclusive.
 *
 * A stay arriving 2027-02-13 13:00 and leaving 2027-02-16 11:00 occupies the
 * nights of the 13th, 14th and 15th. Both bounds are instants, picked by the
 * guest: the house keeps no fixed arrival or departure hour, and the domain has
 * never imposed one.
 *
 * What a stay *occupies* is wider than the stay itself - see `TURNOVER_MS` and
 * `occupancyWindow` below, which is the range the exclusion constraint and the
 * availability query both work in.
 */
export interface DateRange {
  from: Date;
  to: Date;
}

/**
 * The hour a room is out of service after a guest leaves.
 *
 * Someone has to strip the bed and clean the room, so the next arrival cannot be
 * the same instant as the last departure. A guest checking out at 15:00 frees the
 * room from 16:00, and that is the whole rule - the house sells no fixed
 * check-in or check-out hour, only this gap between two stays.
 *
 * Kept in step with `interval '1 hour'` in the `room_stay_occupancy()` SQL
 * function behind the `bookings_room_no_overlap` constraint. If the two drift,
 * availability and the database start disagreeing, and a booking the site called
 * possible fails with a 409.
 */
export const TURNOVER_MS = 60 * 60 * 1000;

/**
 * What a stay actually takes out of the room: the guest's own range, plus the
 * turnover hour after they leave.
 *
 * Two stays may not both happen when their occupancy windows overlap - which is
 * the same predicate as the `[)` tstzrange in `bookings_room_no_overlap`, and
 * the reason the search and the constraint cannot reach different answers.
 */
export const occupancyWindow = (range: DateRange): DateRange => ({
  from: range.from,
  to: new Date(range.to.getTime() + TURNOVER_MS),
});

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
