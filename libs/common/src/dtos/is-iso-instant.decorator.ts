import { applyDecorators } from '@nestjs/common';
import { Matches } from 'class-validator';

/**
 * A full ISO 8601 instant: date, time, and an explicit zone (`Z` or `±HH:MM`).
 *
 * Every temporal value in this system is an instant - there are no calendar-date
 * columns and no date-only fields on the wire - so the zone is mandatory.
 * `@IsISO8601()` is not usable here because it accepts `"2027-02-14"`, which is
 * exactly the shape this contract stopped supporting: read as UTC midnight it is
 * 07:00 on the ridge, which is nobody's idea of a check-in time.
 *
 * Seconds and milliseconds are optional here and truncated server-side; the
 * picker only ever offers hours and half-hours.
 */
export const ISO_INSTANT_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;

export const IsIsoInstant = (): PropertyDecorator =>
  applyDecorators(
    Matches(ISO_INSTANT_PATTERN, {
      message:
        '$property must be an ISO 8601 instant with a time zone, e.g. 2027-02-14T13:00:00.000Z',
    }),
  );
