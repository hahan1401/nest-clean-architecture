import { config } from 'dotenv';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';
import { Logger } from 'nestjs-pino';

config({ path: resolve(process.cwd(), '.env.local'), override: true });

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.TCP,
      options: {
        host: '0.0.0.0',
        port: parseInt(process.env.PAYMENT_SERVICE_PORT || '3003'),
      },
    },
  );
  app.useLogger(app.get(Logger));
  await app.listen();
  console.log(
    `Payment service is running on port ${process.env.PAYMENT_SERVICE_PORT || '3003'}`,
    'Bootstrap',
  );
}
bootstrap();
