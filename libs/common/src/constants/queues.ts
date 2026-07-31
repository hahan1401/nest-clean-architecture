export const NOTIFICATION_QUEUE = 'notifications_queue';

/** Targeted notifications: routing key is the message pattern. */
export const NOTIFICATION_EXCHANGE = 'notifications.topic';

/** Broadcasts: every service instance binds its own queue so all of them receive the event. */
export const NOTIFICATION_BROADCAST_EXCHANGE = 'notifications.fanout';
export const NOTIFICATION_BROADCAST_QUEUE_PREFIX = 'notifications.broadcast';

export const RABBITMQ_DEFAULT_URL = 'amqp://guest:guest@localhost:5672';
