import { BookingConfirmedNotification } from '../../domain/ports/booking-notifier.port';
import { customerBookingConfirmedEmail, ownerBookingConfirmedEmail } from './booking-emails';

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
    checkIn: new Date('2027-02-13'),
    checkOut: new Date('2027-02-16'),
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
  type: 'TOUR',
  tourName: 'Tam Dao Sunrise Trek',
  departureDate: new Date('2027-03-06'),
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

  it('renders the room dates and night count', () => {
    const email = ownerBookingConfirmedEmail(roomNotification());

    expect(email.text).toContain('2027-02-13');
    expect(email.text).toContain('2027-02-16');
    expect(email.text).toContain('3 night(s)');
  });

  it('renders the departure date and seats for a tour', () => {
    const email = ownerBookingConfirmedEmail(tourNotification());

    expect(email.subject).toContain('Tam Dao Sunrise Trek');
    expect(email.text).toContain('departing 2027-03-06');
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
