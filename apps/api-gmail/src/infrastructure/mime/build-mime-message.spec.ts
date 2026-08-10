import type { SendEmailPayload } from '../../domain/usecases/send-email.usecase';
import { buildMimeMessage, toBase64Url } from './build-mime-message';

const basePayload: SendEmailPayload = {
  from: 'no-reply@example.com',
  to: ['guest@example.com'],
  subject: 'Booking confirmed',
  text: 'See you soon',
};

/** Decodes every base64 body in the message, in order. */
function decodeBase64Sections(message: string): string[] {
  const bodies = message.matchAll(
    /Content-Transfer-Encoding: base64\r\n\r\n([\s\S]*?)(?=\r\n--|$)/g,
  );

  return [...bodies].map(([, body]) => Buffer.from(body, 'base64').toString('utf8'));
}

describe('buildMimeMessage', () => {
  it('emits a single text/plain part when only text is present', () => {
    const message = buildMimeMessage(basePayload);

    expect(message).toContain('From: no-reply@example.com');
    expect(message).toContain('To: guest@example.com');
    expect(message).toContain('Content-Type: text/plain; charset="UTF-8"');
    expect(message).not.toContain('multipart/alternative');
    expect(decodeBase64Sections(message)[0]).toContain('See you soon');
  });

  it('emits a single text/html part when only html is present', () => {
    const message = buildMimeMessage({ ...basePayload, text: undefined, html: '<p>Hi</p>' });

    expect(message).toContain('Content-Type: text/html; charset="UTF-8"');
    expect(decodeBase64Sections(message)[0]).toContain('<p>Hi</p>');
  });

  it('emits multipart/alternative with text before html when both are present', () => {
    const message = buildMimeMessage({ ...basePayload, html: '<p>Hi</p>' });

    const boundary = /boundary="(.+)"/.exec(message)?.[1];
    expect(boundary).toBeDefined();
    expect(message).toContain(`--${boundary}--`);
    expect(message.indexOf('text/plain')).toBeLessThan(message.indexOf('text/html'));

    const [text, html] = decodeBase64Sections(message);
    expect(text).toContain('See you soon');
    expect(html).toContain('<p>Hi</p>');
  });

  it('joins recipient lists and includes optional address headers', () => {
    const message = buildMimeMessage({
      ...basePayload,
      to: ['a@example.com', 'b@example.com'],
      cc: ['c@example.com'],
      bcc: ['d@example.com'],
      replyTo: ['owner@example.com'],
    });

    expect(message).toContain('To: a@example.com, b@example.com');
    expect(message).toContain('Cc: c@example.com');
    expect(message).toContain('Bcc: d@example.com');
    expect(message).toContain('Reply-To: owner@example.com');
  });

  it('omits optional address headers when the lists are empty', () => {
    const message = buildMimeMessage({ ...basePayload, cc: [], bcc: [], replyTo: [] });

    expect(message).not.toContain('Cc:');
    expect(message).not.toContain('Bcc:');
    expect(message).not.toContain('Reply-To:');
  });

  it('RFC 2047 encodes non-ASCII subjects', () => {
    const subject = 'Đặt phòng thành công';
    const message = buildMimeMessage({ ...basePayload, subject });

    const encoded = /Subject: (.+)\r\n/.exec(message)?.[1] ?? '';
    expect(encoded).toMatch(/^=\?UTF-8\?B\?.+\?=$/);

    const decoded = Buffer.from(encoded.slice('=?UTF-8?B?'.length, -2), 'base64').toString('utf8');
    expect(decoded).toBe(subject);
  });

  it('leaves plain ASCII subjects untouched', () => {
    expect(buildMimeMessage(basePayload)).toContain('Subject: Booking confirmed\r\n');
  });

  it('wraps encoded bodies at 76 characters', () => {
    const message = buildMimeMessage({ ...basePayload, text: 'x'.repeat(500) });
    const bodyLines = message.split('\r\n\r\n')[1].split('\r\n');

    expect(bodyLines.length).toBeGreaterThan(1);
    bodyLines.forEach((line) => expect(line.length).toBeLessThanOrEqual(76));
  });

  it('round-trips through base64url without padding', () => {
    const message = buildMimeMessage(basePayload);
    const raw = toBase64Url(message);

    expect(raw).not.toMatch(/[+/=]/);
    expect(Buffer.from(raw, 'base64url').toString('utf8')).toBe(message);
  });
});
