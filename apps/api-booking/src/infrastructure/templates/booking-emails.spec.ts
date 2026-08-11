import {
  BookingCancelledNotification,
  BookingConfirmedNotification,
} from '../../domain/ports/booking-notifier.port';
import {
  customerBookingCancelledEmail,
  customerBookingConfirmedEmail,
  ownerBookingCancelledEmail,
  ownerBookingConfirmedEmail,
} from './booking-emails';

/**
 * Fixtures are instants on the HOUSE clock, because that is what the emails
 * render: 13:00 in Da Lat is 06:00Z, 11:00 is 04:00Z, and a 07:10 departure is
 * 00:10Z. Building them any other way tests a time nobody would read.
 */
const houseTime = (isoDay: string, hour: number, minute = 0): Date => {
  const [year, month, day] = isoDay.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour - 7, minute));
};

const cancelledNotification = (
  overrides: Partial<BookingCancelledNotification> = {},
): BookingCancelledNotification =>
  ({
    bookingId: 1,
    reference: 'BK-7F3K9Q2A',
    customerName: 'Tran Thi B',
    customerEmail: 'guest@example.com',
    customerPhone: '0900000000',
    totalAmount: 3_900_000,
    currency: 'VND',
    cancelledAt: new Date('2027-01-06T09:00:00.000Z'),
    reason: null,
    cancelledBy: 'customer',
    type: 'ROOM',
    roomName: 'Garden Room',
    checkIn: houseTime('2027-02-13', 13),
    checkOut: houseTime('2027-02-16', 11),
    nights: 3,
    guests: 2,
    ...overrides,
  }) as BookingCancelledNotification;

const CANCEL_URL = 'http://localhost:3000/bookings/cancel/abc123';

const roomNotification = (
  overrides: Partial<BookingConfirmedNotification> = {},
): BookingConfirmedNotification =>
  ({
    bookingId: 1,
    reference: 'BK-7F3K9Q2A',
    customerName: 'Tran Thi B',
    customerEmail: 'guest@example.com',
    customerPhone: '0900000000',
    totalAmount: 3_900_000,
    currency: 'VND',
    confirmedAt: new Date('2027-01-05T10:00:00.000Z'),
    cancelUrl: CANCEL_URL,
    type: 'ROOM',
    roomName: 'Garden Room',
    checkIn: houseTime('2027-02-13', 13),
    checkOut: houseTime('2027-02-16', 11),
    nights: 3,
    guests: 2,
    ...overrides,
  }) as BookingConfirmedNotification;

const tourNotification = (): BookingConfirmedNotification => ({
  bookingId: 2,
  reference: 'BK-TOUR1234',
  customerName: 'Le Van C',
  customerEmail: 'guest2@example.com',
  customerPhone: '0911111111',
  totalAmount: 1_350_000,
  currency: 'VND',
  confirmedAt: new Date('2027-01-05T10:00:00.000Z'),
  cancelUrl: CANCEL_URL,
  notes: null,
  type: 'TOUR',
  tourName: 'Tam Dao Sunrise Trek',
  departureDate: houseTime('2027-03-06', 7, 10),
  seats: 3,
});

describe('ownerBookingConfirmedEmail', () => {
  it('carries the reference and the guest contact details', () => {
    const email = ownerBookingConfirmedEmail(roomNotification());

    expect(email.subject).toContain('BK-7F3K9Q2A');
    expect(email.subject).toContain('Garden Room');
    expect(email.text).toContain('guest@example.com');
    expect(email.text).toContain('0900000000');
    expect(email.text).toContain('3,900,000 VND');
  });

  it('renders the room moments on the house clock, and the night count', () => {
    const email = ownerBookingConfirmedEmail(roomNotification());

    expect(email.text).toContain('13/02/2027 13:00 (GMT+7)');
    expect(email.text).toContain('16/02/2027 11:00 (GMT+7)');
    expect(email.text).toContain('3 night(s)');
  });

  it('renders the departure moment and seats for a tour', () => {
    const email = ownerBookingConfirmedEmail(tourNotification());

    expect(email.subject).toContain('Tam Dao Sunrise Trek');
    expect(email.text).toContain('departing 06/03/2027 07:10 (GMT+7)');
    expect(email.text).toContain('3 seat(s)');
  });

  it('never contains the cancel link - forwarding this mail would leak it', () => {
    const email = ownerBookingConfirmedEmail(roomNotification());

    expect(email.text).not.toContain(CANCEL_URL);
    expect(email.html).not.toContain(CANCEL_URL);
  });

  it('escapes customer-supplied names in the html body', () => {
    const email = ownerBookingConfirmedEmail(
      roomNotification({ customerName: '<script>alert(1)</script>' }),
    );

    expect(email.html).not.toContain('<script>');
    expect(email.html).toContain('&lt;script&gt;');
    // Plain text needs no escaping and should stay readable.
    expect(email.text).toContain('<script>alert(1)</script>');
  });
});

describe('customerBookingConfirmedEmail', () => {
  it('includes the cancel link in both bodies', () => {
    const email = customerBookingConfirmedEmail(roomNotification());

    expect(email.text).toContain(CANCEL_URL);
    expect(email.html).toContain(CANCEL_URL);
    expect(email.html).toContain(`href="${CANCEL_URL}"`);
  });

  it('leads with the reference and stays non-empty in both bodies', () => {
    const email = customerBookingConfirmedEmail(roomNotification());

    // api-email rejects a message with neither text nor html.
    expect(email.subject).toContain('BK-7F3K9Q2A');
    expect(email.text.length).toBeGreaterThan(0);
    expect(email.html.length).toBeGreaterThan(0);
  });

  it('escapes a hostile name before putting it in the html greeting', () => {
    const email = customerBookingConfirmedEmail(
      roomNotification({ customerName: '"><img src=x onerror=alert(1)>' }),
    );

    expect(email.html).not.toContain('<img');
    expect(email.html).toContain('&lt;img');
  });
});

describe('guest notes on the confirmation emails', () => {
  it('shows the notes to the owner, who may have to act on them', () => {
    const email = ownerBookingConfirmedEmail(
      roomNotification({ notes: 'Arriving late, around 23:00' }),
    );

    expect(email.text).toContain('Notes: Arriving late, around 23:00');
    expect(email.html).toContain('Arriving late, around 23:00');
  });

  it('echoes the notes back to the guest so they can see them recorded', () => {
    const email = customerBookingConfirmedEmail(
      roomNotification({ notes: 'Vegetarian breakfast please' }),
    );

    expect(email.text).toContain('Your notes: Vegetarian breakfast please');
    expect(email.html).toContain('Vegetarian breakfast please');
  });

  it.each([
    ['null', null],
    ['empty', ''],
    ['whitespace only', '   '],
  ])('omits the row entirely when the notes are %s', (_label, notes) => {
    const owner = ownerBookingConfirmedEmail(roomNotification({ notes }));
    const customer = customerBookingConfirmedEmail(roomNotification({ notes }));

    expect(owner.text).not.toContain('Notes:');
    expect(customer.text).not.toContain('Your notes:');
  });

  it('escapes hostile notes before putting them in the html body', () => {
    const email = ownerBookingConfirmedEmail(
      roomNotification({ notes: '<script>alert(1)</script>' }),
    );

    expect(email.html).not.toContain('<script>');
    expect(email.html).toContain('&lt;script&gt;');
  });
});

/**
 * The recipients are both on Vietnam time - the owner reads this in Da Lat, the
 * guest is arriving into it - so a UTC instant was wrong for both, and an
 * unlabelled one is worse: it reads as correct. These tests are what stops a
 * `toISOString()` creeping back in.
 */
describe('times in the emails', () => {
  const everyEmail = () => [
    ownerBookingConfirmedEmail(roomNotification()),
    customerBookingConfirmedEmail(roomNotification()),
    ownerBookingCancelledEmail(cancelledNotification()),
    customerBookingCancelledEmail(cancelledNotification()),
  ];

  it('renders every moment on the house clock, never as a UTC instant', () => {
    for (const email of everyEmail()) {
      expect(email.text).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
      expect(email.html).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
    }
  });

  it('labels the zone on every moment, so a quoted line still means something', () => {
    const email = ownerBookingConfirmedEmail(roomNotification());

    // 10:00Z on 5 Jan is 17:00 on the ridge.
    expect(email.text).toContain('Confirmed at: 05/01/2027 17:00 (GMT+7)');
  });

  it('does the same for a cancellation', () => {
    const email = ownerBookingCancelledEmail(cancelledNotification());

    expect(email.text).toContain('Cancelled at: 06/01/2027 16:00 (GMT+7)');
  });

  it('ends every body with the footnote naming Vietnam time', () => {
    for (const email of everyEmail()) {
      expect(email.text).toContain('All times shown are Vietnam time (Asia/Ho_Chi_Minh, GMT+7)');
      expect(email.html).toContain('All times shown are Vietnam time (Asia/Ho_Chi_Minh, GMT+7)');
    }
  });

  it('keeps the subject compact - the labelled body is one click away', () => {
    const email = ownerBookingConfirmedEmail(roomNotification());

    expect(email.subject).toContain('13/02/2027 13:00');
    expect(email.subject).not.toContain('GMT+7');
  });
});

describe('cancellation reason on the cancellation emails', () => {
  it('reaches the owner alongside who cancelled', () => {
    const email = ownerBookingCancelledEmail(
      cancelledNotification({ reason: 'family emergency', cancelledBy: 'customer' }),
    );

    expect(email.text).toContain('Reason: family emergency');
    expect(email.text).toContain('Cancelled by: Guest (cancellation link)');
  });

  it('reaches the guest too - it matters most when the owner cancelled', () => {
    const email = customerBookingCancelledEmail(
      cancelledNotification({ reason: 'Storm damage to the room', cancelledBy: 'owner' }),
    );

    expect(email.text).toContain('Reason: Storm damage to the room');
    expect(email.html).toContain('Storm damage to the room');
  });

  it('omits the row when no reason was given', () => {
    const owner = ownerBookingCancelledEmail(cancelledNotification({ reason: null }));
    const customer = customerBookingCancelledEmail(cancelledNotification({ reason: null }));

    expect(owner.text).not.toContain('Reason:');
    expect(customer.text).not.toContain('Reason:');
  });

  it('escapes a hostile reason in the html body', () => {
    const email = customerBookingCancelledEmail(
      cancelledNotification({ reason: '<img src=x onerror=alert(1)>' }),
    );

    expect(email.html).not.toContain('<img');
    expect(email.html).toContain('&lt;img');
  });

  it('never offers the spent cancel link back to the guest', () => {
    const email = customerBookingCancelledEmail(cancelledNotification());

    expect(email.text).not.toContain('/bookings/cancel/');
    expect(email.html).not.toContain('/bookings/cancel/');
  });
});
