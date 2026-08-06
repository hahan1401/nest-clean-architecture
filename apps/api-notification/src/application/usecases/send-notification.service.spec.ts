import { ValidationError } from '@app/common';
import { NotificationPublisherPort } from '../../domain/ports/notification-publisher.port';
import { SendNotificationService } from './send-notification.service';

describe('SendNotificationService', () => {
  let service: SendNotificationService;
  let publisher: jest.Mocked<NotificationPublisherPort>;

  beforeEach(() => {
    publisher = {
      emitToUser: jest.fn(),
      broadcast: jest.fn(),
    };
    service = new SendNotificationService(publisher);
  });

  it('publishes the notification to the target user room', () => {
    const result = service.execute({
      userId: 'u1',
      title: 'Payment received',
      message: 'Your order is paid',
    });

    expect(result).toMatchObject({
      userId: 'u1',
      title: 'Payment received',
      message: 'Your order is paid',
      type: 'info',
    });
    expect(publisher.emitToUser).toHaveBeenCalledWith('u1', result);
  });

  it('rejects an empty userId', () => {
    expect(() => service.execute({ userId: '  ', title: 't', message: 'm' })).toThrow(
      ValidationError,
    );
    expect(publisher.emitToUser).not.toHaveBeenCalled();
  });
});
