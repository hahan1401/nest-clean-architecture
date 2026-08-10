import { EMAIL_EXCHANGE, RABBITMQ_DEFAULT_URL } from '@app/common';
import { MessageHandlerErrorBehavior, RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { SendEmailService } from '../../application/usecases/send-email.service';
import { EmailSenderPort } from '../../domain/ports/email-sender.port';
import { GmailTokenPort } from '../../domain/ports/gmail-token.port';
import { GmailEmailSenderService } from '../../infrastructure/services/gmail-email-sender.service';
import { GmailOauthTokenService } from '../../infrastructure/services/gmail-oauth-token.service';
import { GmailEmailController } from '../controllers/gmail-email.controller';

@Module({
  imports: [
    HttpModule,
    RabbitMQModule.forRoot({
      uri: process.env.RABBITMQ_URL || RABBITMQ_DEFAULT_URL,
      // Same exchange as api-email; only the routing key selects the provider.
      exchanges: [{ name: EMAIL_EXCHANGE, type: 'topic' }],
      defaultSubscribeErrorBehavior: MessageHandlerErrorBehavior.NACK,
      enableControllerDiscovery: true,
      deserializer: (msg: Buffer): unknown => {
        const parsed = JSON.parse(msg.toString()) as { data?: unknown } | null;
        return parsed?.data ?? parsed;
      },
    }),
  ],
  providers: [
    GmailOauthTokenService,
    { provide: GmailTokenPort, useExisting: GmailOauthTokenService },
    GmailEmailSenderService,
    { provide: EmailSenderPort, useExisting: GmailEmailSenderService },
    SendEmailService,
  ],
  controllers: [GmailEmailController],
})
export class ApiGmailModule {}
