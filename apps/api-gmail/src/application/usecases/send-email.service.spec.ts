import { ValidationError } from '@app/common';
import type { ConfigService } from '@nestjs/config';
import type { SendEmailInput, SendEmailPayload } from '../../domain/usecases/send-email.usecase';
import { SendEmailService } from './send-email.service';

const VALID: SendEmailInput = {
  to: ['guest@example.com'],
  subject: '  Booking confirmed  ',
  text: '  See you soon  ',
};

describe('SendEmailService', () => {
  let send: jest.Mock;
  let config: Record<string, string | undefined>;
  let service: SendEmailService;

  const sentPayload = () => (send.mock.calls[0] as [SendEmailPayload])[0];

  beforeEach(() => {
    send = jest.fn().mockResolvedValue({ messageId: 'gmail-id' });
    config = { GMAIL_SENDER: 'no-reply@example.com' };

    service = new SendEmailService({ send }, {
      get: (key: string) => config[key],
    } as unknown as ConfigService);
  });

  it('falls back to GMAIL_SENDER and trims the payload', async () => {
    await service.execute(VALID);

    expect(sentPayload()).toEqual(
      expect.objectContaining({
        from: 'no-reply@example.com',
        subject: 'Booking confirmed',
        text: 'See you soon',
      }),
    );
  });

  it('prefers an explicit from over the env default', async () => {
    await service.execute({ ...VALID, from: 'owner@example.com' });

    expect(sentPayload().from).toBe('owner@example.com');
  });

  it('falls back to EMAIL_FROM when GMAIL_SENDER is unset', async () => {
    config = { EMAIL_FROM: 'shared@example.com' };

    await service.execute(VALID);

    expect(sentPayload().from).toBe('shared@example.com');
  });

  it.each<[string, SendEmailInput]>([
    ['no recipients', { ...VALID, to: [] }],
    ['no subject', { ...VALID, subject: '   ' }],
    ['no body', { ...VALID, text: '  ', html: undefined }],
  ])('rejects a payload with %s', async (_label, input) => {
    await expect(service.execute(input)).rejects.toBeInstanceOf(ValidationError);
    expect(send).not.toHaveBeenCalled();
  });

  it('rejects when no sender can be resolved', async () => {
    config = {};

    await expect(service.execute(VALID)).rejects.toThrow(/from is required/);
  });
});
