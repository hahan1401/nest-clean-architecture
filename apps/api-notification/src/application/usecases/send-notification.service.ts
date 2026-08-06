import { ValidationError } from '@app/common';
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Notification } from '../../domain/entities/notification.entity';
import { NotificationPublisherPort } from '../../domain/ports/notification-publisher.port';
import {
  SendNotificationInput,
  SendNotificationUseCase,
} from '../../domain/usecases/send-notification.usecase';

@Injectable()
export class SendNotificationService implements SendNotificationUseCase {
  constructor(private readonly publisher: NotificationPublisherPort) {}

  execute(input: SendNotificationInput): Notification {
    if (!input.userId?.trim()) {
      throw new ValidationError('userId is required to send a notification');
    }

    const notification: Notification = {
      id: randomUUID(),
      userId: input.userId,
      title: input.title,
      message: input.message,
      type: input.type ?? 'info',
      data: input.data,
      createdAt: new Date().toISOString(),
    };

    this.publisher.emitToUser(input.userId, notification);
    return notification;
  }
}
