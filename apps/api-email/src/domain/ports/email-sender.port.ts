import type { SendEmailPayload, SendEmailResult } from '../usecases/send-email.usecase';

/** Outbound port for sending email using any provider (SES, SMTP, etc.). */
export abstract class EmailSenderPort {
  abstract send(input: SendEmailPayload): Promise<SendEmailResult>;
}
