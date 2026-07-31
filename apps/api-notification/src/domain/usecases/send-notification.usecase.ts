import { Notification, NotificationType } from '../entities/notification.entity';

export type NotificationInput = {
  title: string;
  message: string;
  type?: NotificationType;
  data?: Record<string, unknown>;
};

export type SendNotificationInput = NotificationInput & { userId: string };

export interface SendNotificationUseCase {
  execute(input: SendNotificationInput): Notification;
}
