import { BroadcastNotificationDto, NOTIFICATION_PATTERNS, SendNotificationDto } from '@app/common';
import { Controller, Inject } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import { BroadcastNotificationService } from '../../application/usecases/broadcast-notification.service';
import { SendNotificationService } from '../../application/usecases/send-notification.service';

/** Minimal surface of the amqplib channel used for manual acknowledgement. */
type RmqChannel = {
  ack(message: unknown): void;
  nack(message: unknown, allUpTo?: boolean, requeue?: boolean): void;
};

@Controller()
export class NotificationController {
  @Inject()
  private readonly sendNotificationService: SendNotificationService;
  @Inject()
  private readonly broadcastNotificationService: BroadcastNotificationService;

  @EventPattern(NOTIFICATION_PATTERNS.SEND)
  send(@Payload() dto: SendNotificationDto, @Ctx() context: RmqContext) {
    this.settle(context, () => this.sendNotificationService.execute(dto));
  }

  @EventPattern(NOTIFICATION_PATTERNS.BROADCAST)
  broadcast(@Payload() dto: BroadcastNotificationDto, @Ctx() context: RmqContext) {
    this.settle(context, () => this.broadcastNotificationService.execute(dto));
  }

  private settle(context: RmqContext, handle: () => void): void {
    const channel = context.getChannelRef() as RmqChannel;
    const message = context.getMessage();
    try {
      handle();
      channel.ack(message);
    } catch (error) {
      // Drop instead of requeue: a poisoned payload would otherwise loop forever.
      channel.nack(message, false, false);
      throw error;
    }
  }
}
