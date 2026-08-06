export type SendEmailInput = {
  from?: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  replyTo?: string[];
  subject: string;
  text?: string;
  html?: string;
  configurationSetName?: string;
  requestId?: string;
};

export type SendEmailPayload = Omit<SendEmailInput, 'from'> & {
  from: string;
};

export type SendEmailResult = {
  messageId?: string;
};

export abstract class SendEmailUseCase {
  abstract execute(input: SendEmailInput): Promise<SendEmailResult>;
}
