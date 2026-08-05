import { NestFactory } from '@nestjs/core';
import { config } from 'dotenv';
import { Logger } from 'nestjs-pino';
import { resolve } from 'node:path';
import { AppModule } from './app.module';

config({ path: resolve(process.cwd(), '.env.local'), override: true });

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, { bufferLogs: true });
  const logger = app.get(Logger);
  app.useLogger(logger);
  app.flushLogs();

  logger.log('Notification service is connected to RabbitMQ and ready', 'Bootstrap');
}
bootstrap();
