import { Notification } from '../entities/notification.entity';

/** Outbound port: delivers notifications to real-time clients. */
export abstract class NotificationPublisherPort {
  abstract emitToUser(userId: string, notification: Notification): void;
  abstract broadcast(notification: Notification): void;
}
