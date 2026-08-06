import { SendEmailCommand, SESClient, type SESClientConfig } from '@aws-sdk/client-ses';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailSenderPort } from '../../domain/ports/email-sender.port';
import type { SendEmailPayload, SendEmailResult } from '../../domain/usecases/send-email.usecase';

@Injectable()
export class SesEmailSenderService implements EmailSenderPort {
  private readonly client: SESClient;

  constructor(private readonly configService: ConfigService) {
    const region =
      this.configService.get<string>('AWS_SES_REGION') ||
      this.configService.get<string>('AWS_REGION') ||
      'us-east-1';

    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>('AWS_SECRET_ACCESS_KEY');
    const sessionToken = this.configService.get<string>('AWS_SESSION_TOKEN');

    const clientConfig: SESClientConfig = { region };

    if (accessKeyId && secretAccessKey) {
      clientConfig.credentials = {
        accessKeyId,
        secretAccessKey,
        ...(sessionToken ? { sessionToken } : {}),
      };
    }

    this.client = new SESClient(clientConfig);
  }

  async send(input: SendEmailPayload): Promise<SendEmailResult> {
    const command = new SendEmailCommand({
      Source: input.from,
      Destination: {
        ToAddresses: input.to,
        CcAddresses: input.cc,
        BccAddresses: input.bcc,
      },
      ReplyToAddresses: input.replyTo,
      Message: {
        Subject: {
          Data: input.subject,
          Charset: 'UTF-8',
        },
        Body: {
          ...(input.text
            ? {
                Text: {
                  Data: input.text,
                  Charset: 'UTF-8',
                },
              }
            : {}),
          ...(input.html
            ? {
                Html: {
                  Data: input.html,
                  Charset: 'UTF-8',
                },
              }
            : {}),
        },
      },
      ConfigurationSetName: input.configurationSetName,
    });

    const result = await this.client.send(command);

    return {
      messageId: result.MessageId,
    };
  }
}
