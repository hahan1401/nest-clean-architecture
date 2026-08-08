import type { BookingConfirmedNotification } from '../../domain/ports/booking-notifier.port';

export interface BookingEmailContent {
  subject: string;
  text: string;
  html: string;
}

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * Customer-supplied names and notes land in the owner's inbox, so nothing
 * untrusted is interpolated into HTML raw.
 */
const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char);

const formatDate = (value: Date): string => value.toISOString().slice(0, 10);

/** VND has no minor unit, so it formats as a plain grouped integer. */
const formatAmount = (amount: number, currency: string): string =>
  `${new Intl.NumberFormat('en-US').format(amount)} ${currency}`;

const describeBooking = (n: BookingConfirmedNotification): string =>
  n.type === 'ROOM'
    ? `${n.roomName}: ${formatDate(n.checkIn)} to ${formatDate(n.checkOut)} (${n.nights} night(s), ${n.guests} guest(s))`
    : `${n.tourName}: departing ${formatDate(n.departureDate)} (${n.seats} seat(s))`;

const rowsHtml = (rows: Array<[string, string]>): string =>
  [
    '<table cellpadding="6" style="border-collapse:collapse">',
    ...rows.map(
      ([label, value]) =>
        `<tr><td><strong>${escapeHtml(label)}</strong></td><td>${escapeHtml(value)}</td></tr>`,
    ),
    '</table>',
  ].join('');

const rowsText = (rows: Array<[string, string]>): string =>
  rows.map(([label, value]) => `${label}: ${value}`).join('\n');

/**
 * Sent to the homestay owner: operational, contact details first.
 *
 * Deliberately contains no cancel link - forwarding this mail would hand the
 * cancellation credential to whoever received the forward.
 */
export const ownerBookingConfirmedEmail = (
  n: BookingConfirmedNotification,
): BookingEmailContent => {
  const rows: Array<[string, string]> = [
    ['Reference', n.reference],
    ['Booking', describeBooking(n)],
    ['Guest', n.customerName],
    ['Email', n.customerEmail],
    ['Phone', n.customerPhone],
    ['Total', formatAmount(n.totalAmount, n.currency)],
    ['Confirmed at', n.confirmedAt.toISOString()],
  ];

  return {
    subject: `New confirmed booking ${n.reference} - ${describeBooking(n)}`,
    text: ['A booking has just been confirmed.', '', rowsText(rows)].join('\n'),
    html: ['<h2>New confirmed booking</h2>', rowsHtml(rows)].join(''),
  };
};

/** Sent to the guest: reassuring, reference-forward, and carries the cancel link. */
export const customerBookingConfirmedEmail = (
  n: BookingConfirmedNotification,
): BookingEmailContent => {
  const rows: Array<[string, string]> = [
    ['Reference', n.reference],
    ['Booking', describeBooking(n)],
    ['Total', formatAmount(n.totalAmount, n.currency)],
  ];

  const text = [
    `Hi ${n.customerName},`,
    '',
    'Your booking is confirmed. We look forward to hosting you.',
    '',
    rowsText(rows),
    '',
    `Need to cancel? ${n.cancelUrl}`,
  ].join('\n');

  const html = [
    '<h2>Your booking is confirmed</h2>',
    `<p>Hi ${escapeHtml(n.customerName)}, we look forward to hosting you.</p>`,
    rowsHtml(rows),
    `<p><a href="${escapeHtml(n.cancelUrl)}">Cancel this booking</a></p>`,
    `<p style="font-size:12px;color:#666">Or paste this link into your browser: ${escapeHtml(n.cancelUrl)}</p>`,
  ].join('');

  return {
    subject: `Your booking is confirmed - ${n.reference}`,
    text,
    html,
  };
};
