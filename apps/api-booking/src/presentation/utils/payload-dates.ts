import { ISO_INSTANT_PATTERN, ValidationError } from '@app/common';
import { DateRange } from '../../domain/models/date-range';

/**
 * The single place a wire string becomes a Date.
 *
 * The pattern is imported rather than restated: the DTO decorator produces the
 * gateway's 400 and this produces the service's, so if the two ever drifted one
 * side would hand an unparseable string to `new Date` instead of rejecting it.
 *
 * Everything temporal in this system is an instant now - there are no calendar
 * dates left in the database and none on the wire - so a bare `"2027-02-14"` is
 * rejected rather than quietly read as UTC midnight, which is 07:00 on the ridge
 * and not what anyone meant.
 *
 * Seconds and milliseconds are truncated. The site only ever offers hours and
 * half-hours, and a `:30.500` slipped in by hand would otherwise land in the
 * exclusion range and make two stays that look adjacent overlap by half a second.
 */
export const toInstant = (value: string, field = 'date'): Date => {
  if (!ISO_INSTANT_PATTERN.test(value)) {
    throw new ValidationError(
      `${field} must be an ISO 8601 instant with a time zone, e.g. 2027-02-14T13:00:00.000Z`,
    );
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new ValidationError(`${field} is not a valid instant`);
  }
  if (!isRealCalendarMoment(value)) {
    throw new ValidationError(`${field} is not a real date and time`);
  }
  parsed.setUTCSeconds(0, 0);
  return parsed;
};

/**
 * `new Date` rolls a nonexistent date forward instead of rejecting it, so
 * "2027-02-30T13:00Z" silently becomes 2 March and "T24:00" the next midnight -
 * a stay on a date the caller never asked for.
 *
 * The fields are checked as written rather than by round-tripping through
 * `toISOString()`, which is in UTC: a perfectly good "…T13:00:00+07:00" reads
 * back as "…T06:00:00Z" and would fail a naive string comparison.
 */
const isRealCalendarMoment = (value: string): boolean => {
  const [datePart, timePart] = value.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);

  if (hour > 23 || minute > 59) {
    return false;
  }
  // Feeding the day back through Date.UTC is what catches 31 April and 29
  // February in a common year: both roll into the next month.
  const asUtc = new Date(Date.UTC(year, month - 1, day));
  return asUtc.getUTCMonth() === month - 1 && asUtc.getUTCDate() === day;
};

export const toDateRange = (from: string, to: string): DateRange => ({
  from: toInstant(from, 'from'),
  to: toInstant(to, 'to'),
});

export const toOptionalInstant = (value: string | undefined, field = 'date'): Date | null =>
  value === undefined ? null : toInstant(value, field);

/** A history filter's optional window; both ends must be given or neither. */
export const toOptionalRange = (
  from: string | undefined,
  to: string | undefined,
): DateRange | undefined => {
  if (from === undefined && to === undefined) {
    return undefined;
  }
  if (from === undefined || to === undefined) {
    throw new ValidationError('from and to must be supplied together');
  }
  return toDateRange(from, to);
};
