import { overlapping } from './prisma-room.repository';

/**
 * The search predicate and the `bookings_room_no_overlap` constraint have to
 * mean the same thing. The constraint compares `room_stay_occupancy()` of both
 * stays; this asserts the query asks the same question, because the failure mode
 * is silent: a search that is a minute looser than the constraint sells a room
 * and then 409s the guest at the last step.
 */
describe('the availability predicate', () => {
  const HOUR = 60 * 60 * 1000;
  // 14 Feb 13:00 -> 16 Feb 11:00 on the ridge.
  const range = {
    from: new Date('2027-02-14T06:00:00.000Z'),
    to: new Date('2027-02-16T04:00:00.000Z'),
  };

  it('reaches an hour past the requested checkout, for the stay that would arrive too soon', () => {
    expect(overlapping(range).checkIn.lt.getTime()).toBe(range.to.getTime() + HOUR);
  });

  it('reaches an hour before the requested arrival, for the stay that leaves too late', () => {
    // Written as `checkOut > from - 1h` rather than `checkOut + 1h > from`: the
    // same inequality, but against the column, so the index still applies.
    expect(overlapping(range).checkOut.gt.getTime()).toBe(range.from.getTime() - HOUR);
  });

  it('clears a stay that ended exactly an hour before the requested arrival', () => {
    const previousCheckOut = new Date(range.from.getTime() - HOUR);

    expect(previousCheckOut.getTime() > overlapping(range).checkOut.gt.getTime()).toBe(false);
  });

  it('catches a stay that ended a minute inside the hour', () => {
    const previousCheckOut = new Date(range.from.getTime() - HOUR + 60_000);

    expect(previousCheckOut.getTime() > overlapping(range).checkOut.gt.getTime()).toBe(true);
  });
});
