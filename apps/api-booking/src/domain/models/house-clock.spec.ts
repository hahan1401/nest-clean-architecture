import { eachNight, nightCount } from './date-range';
import { houseDayIndex, houseDayStart, houseWeekday, nowHouseDayStart } from './house-clock';

const houseTime = (d: Date) =>
  new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(d);

describe('houseDayStart', () => {
  it('anchors to midnight on the ridge, which is 17:00Z the day before', () => {
    expect(houseDayStart(new Date('2027-02-14T06:00:00.000Z')).toISOString()).toBe(
      '2027-02-13T17:00:00.000Z',
    );
    expect(houseTime(houseDayStart(new Date('2027-02-14T06:00:00.000Z')))).toBe('00:00');
  });

  it('puts an instant in the house day it is actually lived in, not the UTC one', () => {
    // 18:00Z on the 13th is 01:00 on the 14th at the house. Reading the UTC day
    // here is the bug this function exists to stop.
    const lateEvening = new Date('2027-02-13T18:00:00.000Z');

    expect(houseDayIndex(lateEvening)).toBe(houseDayIndex(new Date('2027-02-14T06:00:00.000Z')));
  });

  it('is idempotent', () => {
    const start = houseDayStart(new Date('2027-02-14T06:00:00.000Z'));

    expect(houseDayStart(start).toISOString()).toBe(start.toISOString());
  });
});

describe('houseWeekday', () => {
  it('reads the weekday on the ridge, not in UTC', () => {
    // 2027-02-13 is a Saturday. 17:30Z is already Sunday at the house.
    expect(houseWeekday(new Date('2027-02-13T10:00:00.000Z'))).toBe(6);
    expect(houseWeekday(new Date('2027-02-13T17:30:00.000Z'))).toBe(0);
  });
});

describe('nightCount', () => {
  const range = (from: string, to: string) => ({ from: new Date(from), to: new Date(to) });

  it('counts calendar nights, not 24-hour blocks', () => {
    // 13:00 on the 14th to 09:00 on the 16th: 44 hours, two nights, two nights' rent.
    expect(nightCount(range('2027-02-14T06:00:00.000Z', '2027-02-16T02:00:00.000Z'))).toBe(2);
  });

  it('does not round a late arrival up into an extra night', () => {
    // 23:30 arrival, 09:00 departure the next morning: still one night.
    expect(nightCount(range('2027-02-14T16:30:00.000Z', '2027-02-15T02:00:00.000Z'))).toBe(1);
  });

  it('is zero when arrival and departure fall on the same house day', () => {
    expect(nightCount(range('2027-02-14T02:00:00.000Z', '2027-02-14T13:00:00.000Z'))).toBe(0);
  });
});

describe('eachNight', () => {
  it('yields one instant per night, at the start of each house day', () => {
    const nights = eachNight({
      from: new Date('2027-02-14T08:00:00.000Z'),
      to: new Date('2027-02-16T02:00:00.000Z'),
    });

    expect(nights.map((n) => n.toISOString())).toEqual([
      '2027-02-13T17:00:00.000Z', // the night of the 14th, house time
      '2027-02-14T17:00:00.000Z', // the night of the 15th
    ]);
  });

  it('never bills the departure day', () => {
    const nights = eachNight({
      from: new Date('2027-02-14T06:00:00.000Z'),
      to: new Date('2027-02-16T04:00:00.000Z'),
    });

    expect(nights).toHaveLength(2);
  });
});

describe('nowHouseDayStart', () => {
  it('is the start of the day the house is currently living', () => {
    // 02:00Z on the 14th is 09:00 on the 14th at the house, so "today" started
    // at 17:00Z on the 13th - not at 00:00Z on the 14th, which todayUtc returned.
    expect(nowHouseDayStart(new Date('2027-02-14T02:00:00.000Z')).toISOString()).toBe(
      '2027-02-13T17:00:00.000Z',
    );
  });
});
