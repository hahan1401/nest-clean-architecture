import { ValidationError } from '@app/common';
import { Injectable } from '@nestjs/common';
import { EmailSenderPort } from '../../domain/ports/email-sender.port';
import {
  SendEmailInput,
  SendEmailPayload,
  SendEmailResult,
  SendEmailUseCase,
} from '../../domain/usecases/send-email.usecase';

@Injectable()
export class SendEmailService implements SendEmailUseCase {
  constructor(private readonly emailSender: EmailSenderPort) {}

  async execute(input: SendEmailInput): Promise<SendEmailResult> {
    if (!input.to?.length) {
      throw new ValidationError('to is required to send an email');
    }

    const from = input.from?.trim() || process.env.EMAIL_FROM?.trim();

    if (!from) {
      throw new ValidationError('from is required (payload.from or EMAIL_FROM env)');
    }

    if (!input.subject?.trim()) {
      throw new ValidationError('subject is required to send an email');
    }

    if (!input.text?.trim() && !input.html?.trim()) {
      throw new ValidationError('at least one email body is required: text or html');
    }

    const payload: SendEmailPayload = {
      ...input,
      from,
      subject: input.subject.trim(),
      text: input.text?.trim(),
      html: input.html?.trim(),
    };

    return this.emailSender.send(payload);
  }
}
