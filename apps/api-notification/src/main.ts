import {
  NOTIFICATION_BROADCAST_EXCHANGE,
  NOTIFICATION_BROADCAST_QUEUE_PREFIX,
  NOTIFICATION_EXCHANGE,
  NOTIFICATION_QUEUE,
  RABBITMQ_DEFAULT_URL,
} from '@app/common';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { config } from 'dotenv';
import { Logger } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { AppModule } from './app.module';

config({ path: resolve(process.cwd(), '.env.local'), override: true });

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const logger = app.get(Logger);
  app.useLogger(logger);
  app.flushLogs();
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const urls = [process.env.RABBITMQ_URL || RABBITMQ_DEFAULT_URL];

  // Targeted notifications: topic exchange routed by pattern into one shared durable queue,
  // so replicas compete and each event is delivered exactly once.
  app.connectMicroservice<MicroserviceOptions>(
    {
      transport: Transport.RMQ,
      options: {
        urls,
        exchange: NOTIFICATION_EXCHANGE,
        exchangeType: 'topic',
        wildcards: true,
        queue: process.env.NOTIFICATION_QUEUE || NOTIFICATION_QUEUE,
        queueOptions: { durable: true },
        noAck: false,
      },
    },
    { inheritAppConfig: true },
  );

  // Broadcasts: fanout exchange with an exclusive queue per instance, so every replica
  // receives the event and pushes it to its own connected sockets.
  app.connectMicroservice<MicroserviceOptions>(
    {
      transport: Transport.RMQ,
      options: {
        urls,
        exchange: NOTIFICATION_BROADCAST_EXCHANGE,
        exchangeType: 'fanout',
        queue: `${NOTIFICATION_BROADCAST_QUEUE_PREFIX}.${randomUUID()}`,
        queueOptions: { durable: false, autoDelete: true, exclusive: true },
        noAck: false,
      },
    },
    { inheritAppConfig: true },
  );

  const port = parseInt(process.env.NOTIFICATION_SERVICE_PORT || '3005');
  await app.startAllMicroservices();
  await app.listen(port);
  logger.log(`Notification service is running on port ${port}`, 'Bootstrap');
}
bootstrap();
