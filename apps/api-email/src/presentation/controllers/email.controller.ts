import { EMAIL_EXCHANGE, EMAIL_PATTERNS, EMAIL_QUEUE, SendEmailDto } from '@app/common';
import { RabbitPayload, RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { Controller } from '@nestjs/common';
import { SendEmailService } from '../../application/usecases/send-email.service';

@Controller()
export class EmailController {
  constructor(private readonly sendEmailService: SendEmailService) {}

  @RabbitSubscribe({
    exchange: EMAIL_EXCHANGE,
    routingKey: EMAIL_PATTERNS.SEND,
    queue: process.env.EMAIL_QUEUE || EMAIL_QUEUE,
    queueOptions: { durable: true },
  })
  async send(@RabbitPayload() dto: SendEmailDto) {
    return this.sendEmailService.execute(dto);
  }
}
