import { MessageHandlerErrorBehavior, RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { Module } from '@nestjs/common';
import {
  NOTIFICATION_BROADCAST_EXCHANGE,
  NOTIFICATION_EXCHANGE,
  RABBITMQ_DEFAULT_URL,
} from '@app/common';
import { BroadcastNotificationService } from '../../application/usecases/broadcast-notification.service';
import { SendNotificationService } from '../../application/usecases/send-notification.service';
import { NotificationPublisherPort } from '../../domain/ports/notification-publisher.port';
import { NotificationSocketGateway } from '../../infrastructure/gateways/notification.socket.gateway';
import { NotificationController } from '../controllers/notification.controller';

@Module({
  imports: [
    RabbitMQModule.forRoot({
      uri: process.env.RABBITMQ_URL || RABBITMQ_DEFAULT_URL,
      exchanges: [
        { name: NOTIFICATION_EXCHANGE, type: 'topic' },
        { name: NOTIFICATION_BROADCAST_EXCHANGE, type: 'fanout' },
      ],
      defaultSubscribeErrorBehavior: MessageHandlerErrorBehavior.NACK,
      enableControllerDiscovery: true,
      deserializer: (msg: Buffer) => {
        const parsed = JSON.parse(msg.toString());
        return parsed?.data ?? parsed;
      },
    }),
  ],
  providers: [
    NotificationSocketGateway,
    { provide: NotificationPublisherPort, useExisting: NotificationSocketGateway },
    SendNotificationService,
    BroadcastNotificationService,
  ],
  controllers: [NotificationController],
})
export class ApiNotificationModule {}
