export type NotificationType = 'info' | 'success' | 'warning' | 'error';

/** A notification ready to be pushed to connected clients. */
export type Notification = {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  data?: Record<string, unknown>;
  createdAt: string;
  /** Absent when the notification is broadcast to every connected client. */
  userId?: string;
};
