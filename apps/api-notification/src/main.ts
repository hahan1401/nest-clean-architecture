import { NOTIFICATION_QUEUE, RABBITMQ_DEFAULT_URL } from '@app/common';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { config } from 'dotenv';
import { Logger } from 'nestjs-pino';
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

  // RabbitMQ consumer runs alongside the HTTP server that hosts Socket.IO.
  app.connectMicroservice<MicroserviceOptions>(
    {
      transport: Transport.RMQ,
      options: {
        urls: [process.env.RABBITMQ_URL || RABBITMQ_DEFAULT_URL],
        queue: process.env.NOTIFICATION_QUEUE || NOTIFICATION_QUEUE,
        queueOptions: { durable: true },
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
