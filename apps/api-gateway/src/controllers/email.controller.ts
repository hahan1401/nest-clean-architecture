import type { CorrelatedRequest } from '@app/common';
import { EMAIL_PATTERNS, EMAIL_SERVICE, SendEmailDto } from '@app/common';
import { Body, Controller, HttpCode, HttpStatus, Inject, Post, Req } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';

@Controller('emails')
export class EmailController {
  constructor(@Inject(EMAIL_SERVICE) private readonly emailClient: ClientProxy) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  async send(@Req() req: CorrelatedRequest, @Body() dto: SendEmailDto) {
    await lastValueFrom(
      this.emailClient.emit(EMAIL_PATTERNS.SEND, {
        ...dto,
        requestId: req.requestId,
      }),
    );

    return { queued: true, requestId: req.requestId };
  }

  /** Same exchange, different routing key: api-gmail delivers through the Gmail API. */
  @Post('gmail')
  @HttpCode(HttpStatus.ACCEPTED)
  async sendViaGmail(@Req() req: CorrelatedRequest, @Body() dto: SendEmailDto) {
    await lastValueFrom(
      this.emailClient.emit(EMAIL_PATTERNS.SEND_GMAIL, {
        ...dto,
        requestId: req.requestId,
      }),
    );

    return { queued: true, provider: 'gmail', requestId: req.requestId };
  }
}
