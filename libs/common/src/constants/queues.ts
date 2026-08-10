export const NOTIFICATION_QUEUE = 'notifications_queue';

/** Targeted notifications: routing key is the message pattern. */
export const NOTIFICATION_EXCHANGE = 'notifications.topic';

/** Broadcasts: every service instance binds its own queue so all of them receive the event. */
export const NOTIFICATION_BROADCAST_EXCHANGE = 'notifications.fanout';
export const NOTIFICATION_BROADCAST_QUEUE_PREFIX = 'notifications.broadcast';

/** Email jobs: routing key is the message pattern. */
export const EMAIL_EXCHANGE = 'emails.topic';
export const EMAIL_QUEUE = 'emails_queue';

/** api-gmail binds its own queue to the same exchange so SES traffic is untouched. */
export const GMAIL_QUEUE = 'gmail_emails_queue';

export const RABBITMQ_DEFAULT_URL = 'amqp://guest:guest@localhost:5672';
