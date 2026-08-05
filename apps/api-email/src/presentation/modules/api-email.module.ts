import {
  EMAIL_EXCHANGE,
  RABBITMQ_DEFAULT_URL,
} from '@app/common';
import { MessageHandlerErrorBehavior, RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { Module } from '@nestjs/common';
import { SendEmailService } from '../../application/usecases/send-email.service';
import { EmailSenderPort } from '../../domain/ports/email-sender.port';
import { SesEmailSenderService } from '../../infrastructure/services/ses-email-sender.service';
import { EmailController } from '../controllers/email.controller';

@Module({
  imports: [
    RabbitMQModule.forRoot({
      uri: process.env.RABBITMQ_URL || RABBITMQ_DEFAULT_URL,
      exchanges: [{ name: EMAIL_EXCHANGE, type: 'topic' }],
      defaultSubscribeErrorBehavior: MessageHandlerErrorBehavior.NACK,
      enableControllerDiscovery: true,
      deserializer: (msg: Buffer) => {
        const parsed = JSON.parse(msg.toString());
        return parsed?.data ?? parsed;
      },
    }),
  ],
  providers: [
    SesEmailSenderService,
    { provide: EmailSenderPort, useExisting: SesEmailSenderService },
    SendEmailService,
  ],
  controllers: [EmailController],
})
export class ApiEmailModule {}
