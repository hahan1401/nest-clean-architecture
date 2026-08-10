import { randomBytes } from 'node:crypto';
import type { SendEmailPayload } from '../../domain/usecases/send-email.usecase';

const CRLF = '\r\n';
const PRINTABLE_ASCII = /^[\x20-\x7E]*$/;

/** RFC 2047 encoded word, needed for non-ASCII subjects (Vietnamese diacritics). */
function encodeHeaderValue(value: string): string {
  if (PRINTABLE_ASCII.test(value)) {
    return value;
  }

  return `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`;
}

/** RFC 2045 caps encoded lines at 76 characters. */
function toBase64Body(value: string): string {
  const encoded = Buffer.from(value, 'utf8').toString('base64');
  return (encoded.match(/.{1,76}/g) ?? []).join(CRLF);
}

function part(contentType: string, body: string): string {
  return [
    `Content-Type: ${contentType}; charset="UTF-8"`,
    'Content-Transfer-Encoding: base64',
    '',
    toBase64Body(body),
  ].join(CRLF);
}

/**
 * Builds the RFC 5322 message that `users.messages.send` expects.
 * Gmail strips the Bcc header itself while still delivering to those recipients.
 */
export function buildMimeMessage(input: SendEmailPayload): string {
  const headers: string[] = [`From: ${input.from}`, `To: ${input.to.join(', ')}`];

  if (input.cc?.length) {
    headers.push(`Cc: ${input.cc.join(', ')}`);
  }

  if (input.bcc?.length) {
    headers.push(`Bcc: ${input.bcc.join(', ')}`);
  }

  if (input.replyTo?.length) {
    headers.push(`Reply-To: ${input.replyTo.join(', ')}`);
  }

  headers.push(`Subject: ${encodeHeaderValue(input.subject)}`, 'MIME-Version: 1.0');

  const text = input.text?.trim();
  const html = input.html?.trim();

  if (text && html) {
    const boundary = `----=_gmail_${randomBytes(16).toString('hex')}`;

    return [
      ...headers,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      '',
      // Least-preferred alternative first, per RFC 2046.
      `--${boundary}`,
      part('text/plain', text),
      `--${boundary}`,
      part('text/html', html),
      `--${boundary}--`,
      '',
    ].join(CRLF);
  }

  const body = html ?? text ?? '';
  const contentType = html ? 'text/html' : 'text/plain';

  return [...headers, part(contentType, body), ''].join(CRLF);
}

/** Gmail expects the message base64url-encoded, without padding. */
export function toBase64Url(message: string): string {
  return Buffer.from(message, 'utf8').toString('base64url');
}
