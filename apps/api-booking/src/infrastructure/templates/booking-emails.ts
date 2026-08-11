import { HOUSE_ZONE_LABEL, houseMoment } from '../../domain/models/house-clock';
import type {
  BookingCancelledNotification,
  BookingConfirmedNotification,
  BookingSubject,
} from '../../domain/ports/booking-notifier.port';

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

/**
 * Every time in these emails is the house's own clock, and says so.
 *
 * Both recipients are on Vietnam time - the owner reads this in Da Lat, and the
 * guest is arriving into it - so a UTC instant was wrong for both of them, and
 * an *unlabelled* time is worse than a wrong one: it reads as correct. The
 * label rides along on every moment so a line still means something after being
 * quoted, forwarded or pasted into a message on its own.
 *
 * `houseMoment` is fixed-offset arithmetic, not server-local formatting, so
 * these strings do not change when the service is deployed in another region.
 */
const formatMoment = (value: Date): string => `${houseMoment(value)} (${HOUSE_ZONE_LABEL})`;

/**
 * The footnote every body ends with. Belt and braces alongside the per-line
 * label: this is the one place the zone is spelled out rather than abbreviated.
 */
const TIME_ZONE_NOTE = `All times shown are Vietnam time (Asia/Ho_Chi_Minh, ${HOUSE_ZONE_LABEL}).`;

const timeZoneNoteHtml = `<p style="font-size:12px;color:#666">${TIME_ZONE_NOTE}</p>`;

/** VND has no minor unit, so it formats as a plain grouped integer. */
const formatAmount = (amount: number, currency: string): string =>
  `${new Intl.NumberFormat('en-US').format(amount)} ${currency}`;

const describeBooking = (n: BookingSubject): string =>
  n.type === 'ROOM'
    ? `${n.roomName}: ${formatMoment(n.checkIn)} to ${formatMoment(n.checkOut)} (${n.nights} night(s), ${n.guests} guest(s))`
    : `${n.tourName}: departing ${formatMoment(n.departureDate)} (${n.seats} seat(s))`;

/**
 * The subject line carries the same moments without the zone suffix - repeating
 * "(GMT+7)" twice in an inbox row is noise, and the body it opens onto is fully
 * labelled.
 */
const describeBookingBriefly = (n: BookingSubject): string =>
  n.type === 'ROOM'
    ? `${n.roomName}: ${houseMoment(n.checkIn)} to ${houseMoment(n.checkOut)} (${n.nights} night(s), ${n.guests} guest(s))`
    : `${n.tourName}: departing ${houseMoment(n.departureDate)} (${n.seats} seat(s))`;

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
 * Free-text fields are optional and often blank; an empty "Notes:" row reads as
 * a bug. Spreads to nothing when there is nothing to say.
 */
const optionalRow = (label: string, value: string | null): Array<[string, string]> =>
  value?.trim() ? [[label, value.trim()]] : [];

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
    ['Confirmed at', formatMoment(n.confirmedAt)],
    // Last, and only when the guest wrote something: it is the one row the owner
    // may have to act on before arrival.
    ...optionalRow('Notes', n.notes),
  ];

  return {
    subject: `New confirmed booking ${n.reference} - ${describeBookingBriefly(n)}`,
    text: ['A booking has just been confirmed.', '', rowsText(rows), '', TIME_ZONE_NOTE].join('\n'),
    html: ['<h2>New confirmed booking</h2>', rowsHtml(rows), timeZoneNoteHtml].join(''),
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
    // Echoed back so the guest can see their request was actually recorded.
    ...optionalRow('Your notes', n.notes),
  ];

  const text = [
    `Hi ${n.customerName},`,
    '',
    'Your booking is confirmed. We look forward to hosting you.',
    '',
    rowsText(rows),
    '',
    `Need to cancel? ${n.cancelUrl}`,
    '',
    TIME_ZONE_NOTE,
  ].join('\n');

  const html = [
    '<h2>Your booking is confirmed</h2>',
    `<p>Hi ${escapeHtml(n.customerName)}, we look forward to hosting you.</p>`,
    rowsHtml(rows),
    `<p><a href="${escapeHtml(n.cancelUrl)}">Cancel this booking</a></p>`,
    `<p style="font-size:12px;color:#666">Or paste this link into your browser: ${escapeHtml(n.cancelUrl)}</p>`,
    timeZoneNoteHtml,
  ].join('');

  return {
    subject: `Your booking is confirmed - ${n.reference}`,
    text,
    html,
  };
};

/** "the guest cancelled" reads very differently from "you cancelled" in the owner's inbox. */
const describeActor = (n: BookingCancelledNotification): string =>
  n.cancelledBy === 'customer' ? 'The guest cancelled this booking' : 'This booking was cancelled';

/**
 * Sent to the homestay owner: the slot is free again, so this leads with what
 * was released rather than with an apology.
 */
export const ownerBookingCancelledEmail = (
  n: BookingCancelledNotification,
): BookingEmailContent => {
  const rows: Array<[string, string]> = [
    ['Reference', n.reference],
    ['Booking', describeBooking(n)],
    ['Guest', n.customerName],
    ['Email', n.customerEmail],
    ['Phone', n.customerPhone],
    ['Total', formatAmount(n.totalAmount, n.currency)],
    ['Cancelled at', formatMoment(n.cancelledAt)],
    ['Cancelled by', n.cancelledBy === 'customer' ? 'Guest (cancellation link)' : 'Owner'],
    ...optionalRow('Reason', n.reason),
  ];

  return {
    subject: `Booking cancelled ${n.reference} - ${describeBookingBriefly(n)}`,
    text: [
      `${describeActor(n)}. The slot is available again.`,
      '',
      rowsText(rows),
      '',
      TIME_ZONE_NOTE,
    ].join('\n'),
    html: ['<h2>Booking cancelled</h2>', rowsHtml(rows), timeZoneNoteHtml].join(''),
  };
};

/**
 * Sent to the guest: a receipt of the cancellation. No cancel link - the token
 * is spent, and offering it again would only produce a confusing 409.
 */
export const customerBookingCancelledEmail = (
  n: BookingCancelledNotification,
): BookingEmailContent => {
  const rows: Array<[string, string]> = [
    ['Reference', n.reference],
    ['Booking', describeBooking(n)],
    ['Cancelled at', formatMoment(n.cancelledAt)],
    // Matters most when the owner cancelled: the guest is owed an explanation.
    ...optionalRow('Reason', n.reason),
  ];

  const text = [
    `Hi ${n.customerName},`,
    '',
    'Your booking has been cancelled. Nothing further is needed from you.',
    '',
    rowsText(rows),
    '',
    'If this was not you, reply to this email and we will look into it.',
    '',
    TIME_ZONE_NOTE,
  ].join('\n');

  const html = [
    '<h2>Your booking is cancelled</h2>',
    `<p>Hi ${escapeHtml(n.customerName)}, your booking has been cancelled. Nothing further is needed from you.</p>`,
    rowsHtml(rows),
    '<p style="font-size:12px;color:#666">If this was not you, reply to this email and we will look into it.</p>',
    timeZoneNoteHtml,
  ].join('');

  return {
    subject: `Your booking is cancelled - ${n.reference}`,
    text,
    html,
  };
};
