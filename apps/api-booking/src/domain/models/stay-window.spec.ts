import { toCalendarRange, toStayWindow } from './stay-window';

const range = (from: string, to: string) => ({ from: new Date(from), to: new Date(to) });

describe('toStayWindow', () => {
  it('puts arrival at 13:00 and departure at 11:00 on the HOUSE clock', () => {
    const stay = toStayWindow(range('2027-02-13', '2027-02-16'));

    // Da Lat is UTC+7, so 13:00 on the ridge is 06:00Z. Storing 13:00Z would
    // read as 20:00 to anyone standing in the room.
    expect(stay.from.toISOString()).toBe('2027-02-13T06:00:00.000Z');
    expect(stay.to.toISOString()).toBe('2027-02-16T04:00:00.000Z');
  });

  it('renders back as 13:00 and 11:00 in the house timezone', () => {
    const stay = toStayWindow(range('2027-02-13', '2027-02-16'));
    const houseTime = (d: Date) =>
      new Intl.DateTimeFormat('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Asia/Ho_Chi_Minh',
      }).format(d);

    expect(houseTime(stay.from)).toBe('13:00');
    expect(houseTime(stay.to)).toBe('11:00');
  });

  it('leaves a gap that lets one guest leave and another arrive the same day', () => {
    const leaving = toStayWindow(range('2027-02-11', '2027-02-13'));
    const arriving = toStayWindow(range('2027-02-13', '2027-02-15'));

    // This is the whole point of the hours: under date-only storage these two
    // shared the 13th and the exclusion constraint refused the second booking.
    expect(leaving.to.getTime()).toBeLessThan(arriving.from.getTime());
  });

  it('still collides when the stays genuinely share a night', () => {
    const first = toStayWindow(range('2027-02-11', '2027-02-14'));
    const second = toStayWindow(range('2027-02-13', '2027-02-15'));

    expect(first.to.getTime()).toBeGreaterThan(second.from.getTime());
  });

  it('round-trips back to the calendar dates the guest picked', () => {
    const picked = range('2027-02-13', '2027-02-16');
    const back = toCalendarRange(toStayWindow(picked));

    expect(back.from.toISOString()).toBe(picked.from.toISOString());
    expect(back.to.toISOString()).toBe(picked.to.toISOString());
  });
});
