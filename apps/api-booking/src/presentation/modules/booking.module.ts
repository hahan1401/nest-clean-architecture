import { EMAIL_EXCHANGE, EMAIL_SERVICE, RABBITMQ_DEFAULT_URL } from '@app/common';
import { DatabaseModule } from '@app/database';
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
  ExpireStaleHoldsService,
} from '../../application/usecases/maintenance.service';
import {
  CreatePriceRuleService,
  DeletePriceRuleService,
  ListPriceRulesService,
  QuotePriceService,
} from '../../application/usecases/price-rule.service';
import {
  CheckRoomAvailabilityService,
  CreateRoomService,
  GetRoomService,
  ListRoomBookingsService,
  ListRoomsService,
  SearchAvailableRoomsService,
} from '../../application/usecases/room.service';
import {
  CheckTourAvailabilityService,
  CreateTourDepartureService,
  CreateTourService,
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
import { RoomRepository } from '../../domain/repositories/room.repository';
import { TourDepartureRepository } from '../../domain/repositories/tour-departure.repository';
import { TourRepository } from '../../domain/repositories/tour.repository';

import { RmqBookingNotifierService } from '../../infrastructure/notifiers/rmq-booking-notifier.service';
import { PriceRulePricingService } from '../../infrastructure/pricing/price-rule-pricing.service';
import { PrismaBookingRepository } from '../../infrastructure/repositories/prisma-booking.repository';
import { PrismaPriceRuleRepository } from '../../infrastructure/repositories/prisma-price-rule.repository';
import { PrismaRoomRepository } from '../../infrastructure/repositories/prisma-room.repository';
import { PrismaTourDepartureRepository } from '../../infrastructure/repositories/prisma-tour-departure.repository';
import { PrismaTourRepository } from '../../infrastructure/repositories/prisma-tour.repository';

import { BookingController } from '../controllers/booking.controller';
import { RoomController } from '../controllers/room.controller';
import { TourController } from '../controllers/tour.controller';
import { BookingMaintenanceScheduler } from '../schedulers/booking-maintenance.scheduler';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
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
  controllers: [RoomController, TourController, BookingController],
  providers: [
    // Ports -> implementations
    { provide: RoomRepository, useClass: PrismaRoomRepository },
    { provide: TourRepository, useClass: PrismaTourRepository },
    { provide: TourDepartureRepository, useClass: PrismaTourDepartureRepository },
    { provide: PriceRuleRepository, useClass: PrismaPriceRuleRepository },
    { provide: BookingRepository, useClass: PrismaBookingRepository },
    { provide: PricingPort, useClass: PriceRulePricingService },
    { provide: BookingNotifierPort, useClass: RmqBookingNotifierService },

    // Rooms
    CreateRoomService,
    ListRoomsService,
    GetRoomService,
    SearchAvailableRoomsService,
    CheckRoomAvailabilityService,
    ListRoomBookingsService,

    // Tours
    CreateTourService,
    ListToursService,
    GetTourService,
    CreateTourDepartureService,
    ListTourDeparturesService,
    SearchAvailableDeparturesService,
    CheckTourAvailabilityService,
    ListTourBookingsService,

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
    ExpireStaleHoldsService,
    CloseElapsedDeparturesService,
    CompleteElapsedBookingsService,
    BookingMaintenanceScheduler,
  ],
})
export class BookingModule {}
