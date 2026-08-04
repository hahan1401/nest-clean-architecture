import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { config } from 'dotenv';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { Logger } from 'nestjs-pino';
import type { Server as HttpServer } from 'node:http';
import type { Socket as NetSocket } from 'node:net';
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

  const notificationSocketTarget =
    process.env.NOTIFICATION_SOCKET_TARGET ||
    `http://${process.env.NOTIFICATION_SERVICE_HOST || 'localhost'}:${process.env.NOTIFICATION_SERVICE_PORT || '3005'}`;

  // Proxy Socket.IO engine endpoint to notification service.
  // Namespace "/notifications" still works because Socket.IO uses "/socket.io" as transport path.
  const socketIoProxy = createProxyMiddleware({
    target: notificationSocketTarget,
    changeOrigin: true,
    ws: true,
  });

  app.use('/socket.io', socketIoProxy);

  const httpServer = app.getHttpServer() as HttpServer;
  httpServer.on('upgrade', (req, socket, head) => {
    if (req.url?.startsWith('/socket.io/')) {
      socketIoProxy.upgrade?.(req, socket as NetSocket, head);
    }
  });

  await app.listen(process.env.GATEWAY_PORT ?? 3000);

  logger.log(
    `Gateway service is running on port ${process.env.GATEWAY_PORT || '3000'}`,
    'Bootstrap',
  );
  logger.log(`Socket proxy enabled: /socket.io -> ${notificationSocketTarget}`, 'Bootstrap');
}
bootstrap();
