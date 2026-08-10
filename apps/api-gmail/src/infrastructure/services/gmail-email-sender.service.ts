import { DependencyError } from '@app/common';
import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { EmailSenderPort } from '../../domain/ports/email-sender.port';
import { GmailTokenPort } from '../../domain/ports/gmail-token.port';
import type { SendEmailPayload, SendEmailResult } from '../../domain/usecases/send-email.usecase';
import { describeGoogleError } from '../http/describe-google-error';
import { buildMimeMessage, toBase64Url } from '../mime/build-mime-message';

const DEFAULT_SEND_ENDPOINT = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';

type GmailSendResponse = {
  id?: string;
  threadId?: string;
};

@Injectable()
export class GmailEmailSenderService implements EmailSenderPort {
  private readonly sendEndpoint: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly tokenProvider: GmailTokenPort,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(GmailEmailSenderService.name);

    this.sendEndpoint =
      this.configService.get<string>('GMAIL_SEND_ENDPOINT')?.trim() || DEFAULT_SEND_ENDPOINT;
  }

  async send(input: SendEmailPayload): Promise<SendEmailResult> {
    const raw = toBase64Url(buildMimeMessage(input));

    try {
      const result = await this.post(raw, await this.tokenProvider.getAccessToken());

      this.logger.info(
        { messageId: result.id, requestId: input.requestId, recipients: input.to.length },
        'Email sent through the Gmail API',
      );

      return { messageId: result.id, threadId: result.threadId };
    } catch (error) {
      if (isUnauthorized(error)) {
        // The cached token was revoked or rotated early; refresh once and retry.
        this.tokenProvider.invalidate();

        try {
          const result = await this.post(raw, await this.tokenProvider.getAccessToken());
          return { messageId: result.id, threadId: result.threadId };
        } catch (retryError) {
          throw this.toDependencyError(retryError, input);
        }
      }

      throw this.toDependencyError(error, input);
    }
  }

  private async post(raw: string, accessToken: string): Promise<GmailSendResponse> {
    const response = await this.httpService.axiosRef.post<GmailSendResponse>(
      this.sendEndpoint,
      { raw },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      },
    );

    return response.data ?? {};
  }

  private toDependencyError(error: unknown, input: SendEmailPayload): DependencyError {
    const detail = describeGoogleError(error);

    this.logger.error(
      { err: detail, requestId: input.requestId, subject: input.subject },
      'Gmail API rejected the message',
    );

    return new DependencyError(`Gmail API failed to send the email: ${detail}`, error);
  }
}

function isUnauthorized(error: unknown): boolean {
  return (error as { response?: { status?: number } })?.response?.status === 401;
}
