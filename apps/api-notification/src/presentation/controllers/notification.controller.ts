import {
  BroadcastNotificationDto,
  NOTIFICATION_BROADCAST_EXCHANGE,
  NOTIFICATION_BROADCAST_QUEUE_PREFIX,
  NOTIFICATION_EXCHANGE,
  NOTIFICATION_PATTERNS,
  NOTIFICATION_QUEUE,
  SendNotificationDto,
} from '@app/common';
import { RabbitPayload, RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { Controller, Inject } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { BroadcastNotificationService } from '../../application/usecases/broadcast-notification.service';
import { SendNotificationService } from '../../application/usecases/send-notification.service';

@Controller()
export class NotificationController {
  @Inject()
  private readonly sendNotificationService: SendNotificationService;
  @Inject()
  private readonly broadcastNotificationService: BroadcastNotificationService;

  @RabbitSubscribe({
    exchange: NOTIFICATION_EXCHANGE,
    routingKey: NOTIFICATION_PATTERNS.SEND,
    queue: process.env.NOTIFICATION_QUEUE || NOTIFICATION_QUEUE,
    queueOptions: { durable: true },
  })
  send(@RabbitPayload() dto: SendNotificationDto) {
    this.sendNotificationService.execute(dto);
  }

  // Exclusive per-instance queue: each replica receives every broadcast.
  @RabbitSubscribe({
    exchange: NOTIFICATION_BROADCAST_EXCHANGE,
    routingKey: '',
    queue: `${NOTIFICATION_BROADCAST_QUEUE_PREFIX}.${randomUUID()}`,
    queueOptions: { durable: false, autoDelete: true, exclusive: true },
  })
  broadcast(@RabbitPayload() dto: BroadcastNotificationDto) {
    this.broadcastNotificationService.execute(dto);
  }
}
