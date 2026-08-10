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

/**
 * Booking hold expiry. One message per PENDING booking, delayed by exactly the
 * hold TTL, replacing a poll that ran on every booking whether or not anything
 * had lapsed.
 *
 * RabbitMQ has no native per-message delay and this broker has no
 * rabbitmq_delayed_message_exchange plugin, so the delay is the standard
 * dead-letter trick: the message waits in BOOKING_HOLD_DELAY_QUEUE, which has no
 * consumer, carrying a per-message `expiration`. When that lapses the broker
 * dead-letters it onto BOOKING_HOLD_EXPIRY_QUEUE, where api-booking is waiting.
 */
export const BOOKING_EXCHANGE = 'bookings.topic';

/** The waiting room. Never consumed - messages leave it only by expiring. */
export const BOOKING_HOLD_DELAY_QUEUE = 'booking_hold_delay_queue';

/** Where the delay queue dead-letters to, and where the expiry runs. */
export const BOOKING_HOLD_EXPIRY_QUEUE = 'booking_hold_expiry_queue';

export const RABBITMQ_DEFAULT_URL = 'amqp://guest:guest@localhost:5672';
