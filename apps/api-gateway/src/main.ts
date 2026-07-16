import { config } from 'dotenv';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { ConsoleLogger, Logger, ValidationPipe } from '@nestjs/common';
import { LoggerMiddleware } from 'libs/middlewares/logger.middleware';
import { AppModule } from './app.module';

config({ path: resolve(process.cwd(), '.env.local'), override: true });

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: new ConsoleLogger({
      prefix: 'Api Gateway',
      timestamp: true,
    }),
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(process.env.GATEWAY_PORT ?? 3000);
  Logger.log(
    `Gateway service is running on port ${process.env.GATEWAY_PORT || '3000'}`,
    'Bootstrap',
  );
}
bootstrap();
