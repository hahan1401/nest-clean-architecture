import { Notification } from '../entities/notification.entity';
import { NotificationInput } from './send-notification.usecase';

export interface BroadcastNotificationUseCase {
  execute(input: NotificationInput): Notification;
}
