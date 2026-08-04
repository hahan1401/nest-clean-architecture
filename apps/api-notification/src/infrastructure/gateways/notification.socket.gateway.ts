import { Injectable } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { PinoLogger } from 'nestjs-pino';
import { Namespace, Socket } from 'socket.io';
import { Notification } from '../../domain/entities/notification.entity';
import { NotificationPublisherPort } from '../../domain/ports/notification-publisher.port';

export const NOTIFICATION_EVENT = 'notification';
export const NOTIFICATION_NAMESPACE = /^\/notification.*/;

type SocketData = { userId?: string };

const userRoom = (userId: string) => `user:${userId}`;

function resolveUserId(client: Socket): string | undefined {
  const fromAuth = (client.handshake.auth as { userId?: unknown } | undefined)?.userId;
  if (typeof fromAuth === 'string' && fromAuth.trim()) return fromAuth.trim();

  const fromQuery = client.handshake.query?.userId;
  const raw = Array.isArray(fromQuery) ? fromQuery[0] : fromQuery;
  return typeof raw === 'string' && raw.trim() ? raw.trim() : undefined;
}

/** Socket.IO adapter: keeps one room per user and pushes notifications into it. */
@Injectable()
@WebSocketGateway({ namespace: NOTIFICATION_NAMESPACE, cors: { origin: '*' } })
export class NotificationSocketGateway
  extends NotificationPublisherPort
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  private namespace: Namespace;

  constructor(private readonly logger: PinoLogger) {
    super();
    logger.setContext('NotificationSocketGateway');
  }

  // Identity comes straight from the handshake; swap for a real auth check (JWT) before production.
  handleConnection(client: Socket): void {
    const userId = resolveUserId(client);
    if (!userId) {
      this.logger.warn({ socketId: client.id }, 'Rejected socket without userId');
      client.disconnect(true);
      return;
    }

    (client.data as SocketData).userId = userId;
    void client.join(userRoom(userId));
    this.logger.info({ socketId: client.id, userId }, 'Socket connected');
  }

  handleDisconnect(client: Socket): void {
    this.logger.info(
      { socketId: client.id, userId: (client.data as SocketData).userId },
      'Socket disconnected',
    );
  }

  emitToUser(userId: string, notification: Notification): void {
    this.namespace.to(userRoom(userId)).emit(NOTIFICATION_EVENT, notification);
  }

  broadcast(notification: Notification): void {
    this.namespace.emit(NOTIFICATION_EVENT, notification);
  }
}
