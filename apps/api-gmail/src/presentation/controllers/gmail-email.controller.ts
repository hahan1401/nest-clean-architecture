import { EMAIL_EXCHANGE, EMAIL_PATTERNS, GMAIL_QUEUE, SendEmailDto } from '@app/common';
import { RabbitPayload, RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { Controller } from '@nestjs/common';
import { SendEmailService } from '../../application/usecases/send-email.service';

@Controller()
export class GmailEmailController {
  constructor(private readonly sendEmailService: SendEmailService) {}

  @RabbitSubscribe({
    exchange: EMAIL_EXCHANGE,
    routingKey: EMAIL_PATTERNS.SEND_GMAIL,
    queue: process.env.GMAIL_QUEUE || GMAIL_QUEUE,
    queueOptions: { durable: true },
  })
  async send(@RabbitPayload() dto: SendEmailDto) {
    return this.sendEmailService.execute(dto);
  }
}
