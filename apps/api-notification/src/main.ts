import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
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

  const port = parseInt(process.env.NOTIFICATION_SERVICE_PORT || '3005');
  await app.listen(port);
  logger.log(`Notification service is running on port ${port}`, 'Bootstrap');
}
bootstrap();
