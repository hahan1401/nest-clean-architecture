import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { config } from 'dotenv';
import { Logger } from 'nestjs-pino';
import { resolve } from 'node:path';
import { AppModule } from './app.module';

config({ path: resolve(process.cwd(), '.env.local'), override: true });

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {});
  app.useLogger(app.get(Logger));
  app.enableCors();

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(process.env.GATEWAY_PORT ?? 3000);
  console.log(
    `Gateway service is running on port ${process.env.GATEWAY_PORT || '3000'}`,
    'Bootstrap',
  );
}
bootstrap();
