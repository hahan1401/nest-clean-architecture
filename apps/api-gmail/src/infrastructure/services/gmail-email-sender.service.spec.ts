import { DependencyError } from '@app/common';
import type { HttpService } from '@nestjs/axios';
import type { ConfigService } from '@nestjs/config';
import type { PinoLogger } from 'nestjs-pino';
import type { SendEmailPayload } from '../../domain/usecases/send-email.usecase';
import { GmailEmailSenderService } from './gmail-email-sender.service';

type PostArgs = [string, { raw: string }, { headers: Record<string, string> }];

const PAYLOAD: SendEmailPayload = {
  from: 'no-reply@example.com',
  to: ['guest@example.com'],
  subject: 'Booking confirmed',
  text: 'See you soon',
};

function unauthorized() {
  return { response: { status: 401, data: { error: { status: 'UNAUTHENTICATED' } } } };
}

describe('GmailEmailSenderService', () => {
  let post: jest.Mock;
  let tokenProvider: { getAccessToken: jest.Mock; invalidate: jest.Mock };
  let service: GmailEmailSenderService;

  const postCall = (index: number) => post.mock.calls[index] as PostArgs;

  beforeEach(() => {
    post = jest.fn().mockResolvedValue({ data: { id: 'gmail-id', threadId: 'thread-id' } });

    tokenProvider = {
      getAccessToken: jest.fn().mockResolvedValue('access-token'),
      invalidate: jest.fn(),
    };

    const configService = { get: jest.fn().mockReturnValue(undefined) } as unknown as ConfigService;
    const httpService = { axiosRef: { post } } as unknown as HttpService;
    const logger = {
      setContext: jest.fn(),
      info: jest.fn(),
      error: jest.fn(),
    } as unknown as PinoLogger;

    service = new GmailEmailSenderService(configService, httpService, tokenProvider, logger);
  });

  it('posts a base64url raw message with a bearer token', async () => {
    const result = await service.send(PAYLOAD);

    expect(result).toEqual({ messageId: 'gmail-id', threadId: 'thread-id' });

    const [url, body, options] = postCall(0);
    expect(url).toContain('/gmail/v1/users/me/messages/send');
    expect(options.headers.Authorization).toBe('Bearer access-token');
    expect(Buffer.from(body.raw, 'base64url').toString('utf8')).toContain(
      'Subject: Booking confirmed',
    );
  });

  it('refreshes the token and retries once on 401', async () => {
    post.mockRejectedValueOnce(unauthorized());
    tokenProvider.getAccessToken
      .mockResolvedValueOnce('stale-token')
      .mockResolvedValueOnce('fresh-token');

    const result = await service.send(PAYLOAD);

    expect(result.messageId).toBe('gmail-id');
    expect(tokenProvider.invalidate).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledTimes(2);
    expect(postCall(1)[2].headers.Authorization).toBe('Bearer fresh-token');
  });

  it('gives up after a second 401', async () => {
    post.mockRejectedValue(unauthorized());

    await expect(service.send(PAYLOAD)).rejects.toBeInstanceOf(DependencyError);
    expect(post).toHaveBeenCalledTimes(2);
  });

  it('surfaces the Gmail error message without retrying on other failures', async () => {
    post.mockRejectedValue({
      response: {
        status: 400,
        data: { error: { status: 'INVALID_ARGUMENT', message: 'bad raw' } },
      },
    });

    await expect(service.send(PAYLOAD)).rejects.toThrow(/INVALID_ARGUMENT: bad raw/);
    expect(post).toHaveBeenCalledTimes(1);
    expect(tokenProvider.invalidate).not.toHaveBeenCalled();
  });
});
