import { ValidationError } from '@app/common';
import { DateRange } from '../../domain/models/date-range';

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The single place date-only strings become Dates.
 *
 * Room stays are CALENDAR dates, not instants. `new Date('2027-02-14')` is
 * parsed as UTC midnight, which is exactly how Prisma materialises @db.Date
 * columns; `new Date(2027, 1, 14)` would be local time and would shift the night
 * by one in any non-UTC deployment, silently corrupting overlap checks.
 */
export const toUtcDate = (value: string, field = 'date'): Date => {
  if (!DATE_ONLY_PATTERN.test(value)) {
    throw new ValidationError(`${field} must be a calendar date in YYYY-MM-DD form`);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new ValidationError(`${field} is not a valid calendar date`);
  }
  return parsed;
};

export const toDateRange = (from: string, to: string): DateRange => ({
  from: toUtcDate(from, 'from'),
  to: toUtcDate(to, 'to'),
});

export const toOptionalUtcDate = (value: string | undefined, field = 'date'): Date | null =>
  value === undefined ? null : toUtcDate(value, field);

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
