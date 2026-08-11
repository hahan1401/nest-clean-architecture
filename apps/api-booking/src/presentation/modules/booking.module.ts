import {
  BOOKING_EXCHANGE,
  BOOKING_HOLD_DELAY_QUEUE,
  BOOKING_HOLD_PATTERNS,
  EMAIL_EXCHANGE,
  EMAIL_SERVICE,
  RABBITMQ_DEFAULT_URL,
} from '@app/common';
import { DatabaseModule } from '@app/database';
import { MessageHandlerErrorBehavior, RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';

import {
  CancelBookingByTokenService,
  CancelBookingService,
  GetBookingByCancellationTokenService,
} from '../../application/usecases/cancel-booking.service';
import { ConfirmBookingService } from '../../application/usecases/confirm-booking.service';
import { CreateBookingService } from '../../application/usecases/create-booking.service';
import {
  GetBookingByReferenceService,
  GetBookingService,
} from '../../application/usecases/get-booking.service';
import {
  CloseElapsedDeparturesService,
  CompleteElapsedBookingsService,
  ExpireBookingHoldService,
} from '../../application/usecases/maintenance.service';
import {
  CreatePriceRuleService,
  DeletePriceRuleService,
  ListPriceRulesService,
  QuotePriceService,
} from '../../application/usecases/price-rule.service';
import {
  AddRoomImageService,
  RemoveRoomImageService,
  ReorderRoomImagesService,
} from '../../application/usecases/room-image.service';
import {
  CheckRoomAvailabilityService,
  CreateRoomService,
  GetRoomByCodeService,
  GetRoomService,
  ListRoomBookingsService,
  ListRoomsService,
  SearchAvailableRoomsService,
} from '../../application/usecases/room.service';
import {
  AddTourImageService,
  RemoveTourImageService,
  ReorderTourImagesService,
} from '../../application/usecases/tour-image.service';
import {
  CheckTourAvailabilityService,
  CreateTourDepartureService,
  CreateTourService,
  GetTourBySlugService,
  GetTourService,
  ListTourBookingsService,
  ListTourDeparturesService,
  ListToursService,
  SearchAvailableDeparturesService,
} from '../../application/usecases/tour.service';

import { BookingNotifierPort } from '../../domain/ports/booking-notifier.port';
import { PricingPort } from '../../domain/ports/pricing.port';
import { BookingRepository } from '../../domain/repositories/booking.repository';
import { PriceRuleRepository } from '../../domain/repositories/price-rule.repository';
import { RoomImageRepository } from '../../domain/repositories/room-image.repository';
import { RoomRepository } from '../../domain/repositories/room.repository';
import { TourDepartureRepository } from '../../domain/repositories/tour-departure.repository';
import { TourImageRepository } from '../../domain/repositories/tour-image.repository';
import { TourRepository } from '../../domain/repositories/tour.repository';

import { RmqBookingNotifierService } from '../../infrastructure/notifiers/rmq-booking-notifier.service';
import { PriceRulePricingService } from '../../infrastructure/pricing/price-rule-pricing.service';
import { PrismaBookingRepository } from '../../infrastructure/repositories/prisma-booking.repository';
import { PrismaPriceRuleRepository } from '../../infrastructure/repositories/prisma-price-rule.repository';
import { PrismaRoomImageRepository } from '../../infrastructure/repositories/prisma-room-image.repository';
import { PrismaRoomRepository } from '../../infrastructure/repositories/prisma-room.repository';
import { PrismaTourDepartureRepository } from '../../infrastructure/repositories/prisma-tour-departure.repository';
import { PrismaTourImageRepository } from '../../infrastructure/repositories/prisma-tour-image.repository';
import { PrismaTourRepository } from '../../infrastructure/repositories/prisma-tour.repository';

import { BookingHoldSchedulerPort } from '../../domain/ports/booking-hold-scheduler.port';
import { RmqBookingHoldScheduler } from '../../infrastructure/schedulers/rmq-booking-hold.scheduler';
import { BookingController } from '../controllers/booking.controller';
import { BookingHoldController } from '../controllers/booking-hold.controller';
import { RoomController } from '../controllers/room.controller';
import { TourController } from '../controllers/tour.controller';
import { BookingMaintenanceScheduler } from '../schedulers/booking-maintenance.scheduler';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    RabbitMQModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('RABBITMQ_URL') ?? RABBITMQ_DEFAULT_URL,
        exchanges: [{ name: BOOKING_EXCHANGE, type: 'topic' }],
        queues: [
          {
            // The delay itself. Nothing consumes this queue: a message waits out
            // its per-message `expiration` here, and the broker then dead-letters
            // it to BOOKING_HOLD_PATTERNS.EXPIRE, where the subscriber is.
            //
            // Per-message TTL is only evaluated at the head of the queue, so this
            // is exact only while every message carries the same delay - which is
            // the case, because every hold uses BOOKING_HOLD_TTL_MINUTES. Raise
            // that value and messages already queued keep the old, longer wait
            // ahead of the new ones; the reconciliation sweep covers the gap.
            name: BOOKING_HOLD_DELAY_QUEUE,
            exchange: BOOKING_EXCHANGE,
            routingKey: BOOKING_HOLD_PATTERNS.SCHEDULED,
            createQueueIfNotExists: true,
            options: {
              durable: true,
              arguments: {
                'x-dead-letter-exchange': BOOKING_EXCHANGE,
                'x-dead-letter-routing-key': BOOKING_HOLD_PATTERNS.EXPIRE,
              },
            },
          },
        ],
        defaultSubscribeErrorBehavior: MessageHandlerErrorBehavior.NACK,
        enableControllerDiscovery: true,
      }),
    }),
    ClientsModule.registerAsync([
      {
        name: EMAIL_SERVICE,
        // registerAsync, not register: the gateway's register() reads
        // process.env while the @Module decorator argument is evaluated, which
        // in the compiled output runs before main.ts loads .env.local. Resolving
        // through ConfigService happens at DI time and sees the real value.
        useFactory: (configService: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [configService.get<string>('RABBITMQ_URL') ?? RABBITMQ_DEFAULT_URL],
            // Publishes to the same topic exchange api-email binds emails_queue
            // to. wildcards:true is load-bearing: ClientRMQ.dispatchEvent only
            // calls channel.publish(exchange, routingKey) on that branch -
            // without it it calls sendToQueue(undefined) and the email vanishes.
            exchange: EMAIL_EXCHANGE,
            exchangeType: 'topic',
            wildcards: true,
          },
        }),
        inject: [ConfigService],
      },
    ]),
  ],
  controllers: [RoomController, TourController, BookingController, BookingHoldController],
  providers: [
    // Ports -> implementations
    { provide: RoomRepository, useClass: PrismaRoomRepository },
    { provide: TourRepository, useClass: PrismaTourRepository },
    { provide: TourDepartureRepository, useClass: PrismaTourDepartureRepository },
    { provide: PriceRuleRepository, useClass: PrismaPriceRuleRepository },
    { provide: RoomImageRepository, useClass: PrismaRoomImageRepository },
    { provide: TourImageRepository, useClass: PrismaTourImageRepository },
    { provide: BookingRepository, useClass: PrismaBookingRepository },
    { provide: PricingPort, useClass: PriceRulePricingService },
    { provide: BookingNotifierPort, useClass: RmqBookingNotifierService },
    { provide: BookingHoldSchedulerPort, useClass: RmqBookingHoldScheduler },

    // Rooms
    CreateRoomService,
    ListRoomsService,
    GetRoomService,
    GetRoomByCodeService,
    SearchAvailableRoomsService,
    CheckRoomAvailabilityService,
    ListRoomBookingsService,
    AddRoomImageService,
    RemoveRoomImageService,
    ReorderRoomImagesService,

    // Tours
    CreateTourService,
    ListToursService,
    GetTourService,
    GetTourBySlugService,
    CreateTourDepartureService,
    ListTourDeparturesService,
    SearchAvailableDeparturesService,
    CheckTourAvailabilityService,
    ListTourBookingsService,
    AddTourImageService,
    RemoveTourImageService,
    ReorderTourImagesService,

    // Pricing
    CreatePriceRuleService,
    ListPriceRulesService,
    DeletePriceRuleService,
    QuotePriceService,

    // Bookings
    CreateBookingService,
    ConfirmBookingService,
    CancelBookingService,
    GetBookingService,
    GetBookingByReferenceService,
    GetBookingByCancellationTokenService,
    CancelBookingByTokenService,

    // Maintenance
    ExpireBookingHoldService,
    CloseElapsedDeparturesService,
    CompleteElapsedBookingsService,
    BookingMaintenanceScheduler,
  ],
})
export class BookingModule {}
