import type { SendEmailPayload, SendEmailResult } from '../usecases/send-email.usecase';

/** Outbound port for sending email using any provider (Gmail API here). */
export abstract class EmailSenderPort {
  abstract send(input: SendEmailPayload): Promise<SendEmailResult>;
}
