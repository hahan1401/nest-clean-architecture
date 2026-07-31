import { Module } from '@nestjs/common';
import { BroadcastNotificationService } from '../../application/usecases/broadcast-notification.service';
import { SendNotificationService } from '../../application/usecases/send-notification.service';
import { NotificationPublisherPort } from '../../domain/ports/notification-publisher.port';
import { NotificationSocketGateway } from '../../infrastructure/gateways/notification.socket.gateway';
import { NotificationController } from '../controllers/notification.controller';

@Module({
  providers: [
    NotificationSocketGateway,
    { provide: NotificationPublisherPort, useExisting: NotificationSocketGateway },
    SendNotificationService,
    BroadcastNotificationService,
  ],
  controllers: [NotificationController],
})
export class ApiNotificationModule {}
