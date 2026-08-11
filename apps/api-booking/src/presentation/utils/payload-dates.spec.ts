import { ValidationError } from '@app/common';
import { toInstant, toOptionalRange } from './payload-dates';

describe('toInstant', () => {
  it('accepts a full instant with Z and returns the moment it names', () => {
    expect(toInstant('2027-02-14T06:00:00.000Z').toISOString()).toBe('2027-02-14T06:00:00.000Z');
  });

  it('accepts an explicit offset and normalises it to the same instant', () => {
    // 13:00 on the ridge is 06:00Z. Both spellings must land on one moment.
    expect(toInstant('2027-02-14T13:00:00+07:00').toISOString()).toBe('2027-02-14T06:00:00.000Z');
  });

  it('accepts an instant without seconds', () => {
    expect(toInstant('2027-02-14T06:00Z').toISOString()).toBe('2027-02-14T06:00:00.000Z');
  });

  it('truncates seconds and milliseconds, whatever the offset', () => {
    // A stray fraction inside an exclusion range makes two stays that look
    // adjacent overlap by half a second.
    expect(toInstant('2027-02-14T06:00:30.500Z').toISOString()).toBe('2027-02-14T06:00:00.000Z');
    expect(toInstant('2027-02-14T13:00:30.999+05:45').toISOString()).toBe(
      '2027-02-14T07:15:00.000Z',
    );
  });

  it.each([
    ['a calendar date', '2027-02-14'],
    ['no time zone', '2027-02-14T13:00'],
    ['an offset without a colon', '2027-02-14T13:00+07'],
    ['a lowercase z', '2027-02-14t06:00:00z'],
    ['surrounding whitespace', ' 2027-02-14T06:00:00Z '],
    ['an empty string', ''],
  ])('rejects %s', (_label, value) => {
    expect(() => toInstant(value)).toThrow(ValidationError);
  });

  it.each([
    ['31 April', '2027-04-31T06:00:00Z'],
    ['30 February', '2027-02-30T06:00:00Z'],
    ['29 February in a common year', '2027-02-29T06:00:00Z'],
    ['hour 24', '2027-02-14T24:00:00Z'],
  ])('rejects %s rather than rolling it into the next day', (_label, value) => {
    // `new Date` accepts all of these and silently moves them forward, which
    // would book a stay on a date nobody asked for.
    expect(() => toInstant(value)).toThrow(ValidationError);
  });

  it('accepts 29 February in a leap year', () => {
    expect(toInstant('2028-02-29T06:00:00Z').toISOString()).toBe('2028-02-29T06:00:00.000Z');
  });

  it('names the field it rejected', () => {
    expect(() => toInstant('2027-02-14', 'checkIn')).toThrow(/checkIn/);
  });
});

describe('toOptionalRange', () => {
  it('is undefined when neither end is given', () => {
    expect(toOptionalRange(undefined, undefined)).toBeUndefined();
  });

  it.each([
    ['only from', '2027-02-14T06:00:00Z', undefined],
    ['only to', undefined, '2027-02-16T04:00:00Z'],
  ])('rejects %s - half a window is not a window', (_label, from, to) => {
    expect(() => toOptionalRange(from, to)).toThrow(ValidationError);
  });

  it('parses both ends when both are given', () => {
    const range = toOptionalRange('2027-02-14T06:00:00Z', '2027-02-16T04:00:00Z');

    expect(range?.from.toISOString()).toBe('2027-02-14T06:00:00.000Z');
    expect(range?.to.toISOString()).toBe('2027-02-16T04:00:00.000Z');
  });
});
