import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Notification } from '../../domain/entities/notification.entity';
import { NotificationPublisherPort } from '../../domain/ports/notification-publisher.port';
import { BroadcastNotificationUseCase } from '../../domain/usecases/broadcast-notification.usecase';
import { NotificationInput } from '../../domain/usecases/send-notification.usecase';

@Injectable()
export class BroadcastNotificationService implements BroadcastNotificationUseCase {
  constructor(private readonly publisher: NotificationPublisherPort) {}

  execute(input: NotificationInput): Notification {
    const notification: Notification = {
      id: randomUUID(),
      title: input.title,
      message: input.message,
      type: input.type ?? 'info',
      data: input.data,
      createdAt: new Date().toISOString(),
    };

    this.publisher.broadcast(notification);
    return notification;
  }
}
