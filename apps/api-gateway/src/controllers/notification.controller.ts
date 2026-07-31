import type { CorrelatedRequest } from '@app/common';
import {
  BroadcastNotificationDto,
  NOTIFICATION_PATTERNS,
  NOTIFICATION_SERVICE,
  SendNotificationDto,
} from '@app/common';
import { Body, Controller, HttpCode, HttpStatus, Inject, Post, Req } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';

@Controller('notifications')
export class NotificationController {
  constructor(@Inject(NOTIFICATION_SERVICE) private readonly notificationClient: ClientProxy) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  async send(@Req() req: CorrelatedRequest, @Body() dto: SendNotificationDto) {
    await lastValueFrom(
      this.notificationClient.emit(NOTIFICATION_PATTERNS.SEND, {
        ...dto,
        requestId: req.requestId,
      }),
    );
    return { queued: true, requestId: req.requestId };
  }

  @Post('broadcast')
  @HttpCode(HttpStatus.ACCEPTED)
  async broadcast(@Req() req: CorrelatedRequest, @Body() dto: BroadcastNotificationDto) {
    await lastValueFrom(
      this.notificationClient.emit(NOTIFICATION_PATTERNS.BROADCAST, {
        ...dto,
        requestId: req.requestId,
      }),
    );
    return { queued: true, requestId: req.requestId };
  }
}
