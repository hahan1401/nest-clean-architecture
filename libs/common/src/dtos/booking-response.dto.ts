import {
  AvailableDeparture,
  BookableType,
  Booking,
  BookingLine,
  BookingStatus,
  DepartureStatus,
  PriceQuote,
  PriceQuoteLine,
  PriceRule,
  PriceSource,
  Room,
  Tour,
  TourDeparture,
} from '@app/database';

/** Calendar dates leave the API as date-only strings, the same shape they arrive in. */
const toDateOnly = (value: Date | null | undefined): string | null =>
  value ? value.toISOString().slice(0, 10) : null;

export class RoomResponseDto {
  id: string;
  code: string;
  name: string;
  description: string | null;
  maxGuests: number;
  basePrice: number;
  isActive: boolean;

  constructor(room: Room) {
    this.id = room.id;
    this.code = room.code;
    this.name = room.name;
    this.description = room.description ?? null;
    this.maxGuests = room.maxGuests;
    this.basePrice = room.basePrice;
    this.isActive = room.isActive;
  }
}

export class PriceQuoteLineResponseDto {
  date: string | null;
  quantity: number;
  unitAmount: number;
  amount: number;
  source: PriceSource;
  priceRuleId: string | null;

  constructor(line: PriceQuoteLine) {
    this.date = toDateOnly(line.date);
    this.quantity = line.quantity;
    this.unitAmount = line.unitAmount;
    this.amount = line.amount;
    this.source = line.source;
    this.priceRuleId = line.priceRuleId;
  }
}

export class PriceQuoteResponseDto {
  currency: string;
  total: number;
  lines: PriceQuoteLineResponseDto[];

  constructor(quote: PriceQuote) {
    this.currency = quote.currency;
    this.total = quote.total;
    this.lines = quote.lines.map((line) => new PriceQuoteLineResponseDto(line));
  }
}

/** A room paired with whether it is free for the requested window, and at what price. */
export class RoomAvailabilityResponseDto {
  room: RoomResponseDto;
  available: boolean;
  quote: PriceQuoteResponseDto | null;

  constructor(room: Room, available: boolean, quote: PriceQuote | null) {
    this.room = new RoomResponseDto(room);
    this.available = available;
    this.quote = quote ? new PriceQuoteResponseDto(quote) : null;
  }
}

export class TourResponseDto {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  durationDays: number;
  basePricePerPerson: number;
  isActive: boolean;

  constructor(tour: Tour) {
    this.id = tour.id;
    this.slug = tour.slug;
    this.name = tour.name;
    this.description = tour.description ?? null;
    this.durationDays = tour.durationDays;
    this.basePricePerPerson = tour.basePricePerPerson;
    this.isActive = tour.isActive;
  }
}

export class TourDepartureResponseDto {
  id: string;
  tourId: string;
  departureDate: string | null;
  capacity: number;
  bookedSeats: number;
  remainingSeats: number;
  priceOverride: number | null;
  status: DepartureStatus;

  constructor(departure: TourDeparture) {
    this.id = departure.id;
    this.tourId = departure.tourId;
    this.departureDate = toDateOnly(departure.departureDate);
    this.capacity = departure.capacity;
    this.bookedSeats = departure.bookedSeats;
    this.remainingSeats = departure.capacity - departure.bookedSeats;
    this.priceOverride = departure.priceOverride ?? null;
    this.status = departure.status;
  }
}

export class AvailableDepartureResponseDto extends TourDepartureResponseDto {
  tourName: string;
  pricePerPerson: number;

  constructor(departure: AvailableDeparture) {
    super(departure);
    this.tourName = departure.tourName;
    this.pricePerPerson = departure.pricePerPerson;
    this.remainingSeats = departure.remainingSeats;
  }
}

export class PriceRuleResponseDto {
  id: string;
  name: string;
  roomId: string | null;
  tourId: string | null;
  startDate: string | null;
  endDate: string | null;
  daysOfWeek: number[];
  amount: number;
  priority: number;
  isActive: boolean;

  constructor(rule: PriceRule) {
    this.id = rule.id;
    this.name = rule.name;
    this.roomId = rule.roomId ?? null;
    this.tourId = rule.tourId ?? null;
    this.startDate = toDateOnly(rule.startDate);
    this.endDate = toDateOnly(rule.endDate);
    this.daysOfWeek = rule.daysOfWeek;
    this.amount = rule.amount;
    this.priority = rule.priority;
    this.isActive = rule.isActive;
  }
}

export class BookingLineResponseDto {
  date: string | null;
  quantity: number;
  unitAmount: number;
  amount: number;
  priceSource: PriceSource;

  constructor(line: BookingLine) {
    this.date = toDateOnly(line.lineDate);
    this.quantity = line.quantity;
    this.unitAmount = line.unitAmount;
    this.amount = line.amount;
    this.priceSource = line.priceSource;
  }
}

/**
 * Note what is absent: `cancellationToken`. It is a bearer credential that only
 * ever travels inside the customer's confirmation email, never in an API
 * response - anyone who can read a booking could otherwise cancel it.
 */
export class BookingResponseDto {
  id: string;
  reference: string;
  type: BookableType;
  status: BookingStatus;

  roomId: string | null;
  checkIn: string | null;
  checkOut: string | null;

  tourDepartureId: string | null;
  seats: number | null;

  guests: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;

  totalAmount: number;
  currency: string;
  notes: string | null;

  holdExpiresAt: Date | null;
  confirmedAt: Date | null;
  cancelledAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;

  lines: BookingLineResponseDto[] | null;

  constructor(booking: Booking) {
    this.id = booking.id;
    this.reference = booking.reference;
    this.type = booking.type;
    this.status = booking.status;
    this.roomId = booking.roomId ?? null;
    this.checkIn = toDateOnly(booking.checkIn);
    this.checkOut = toDateOnly(booking.checkOut);
    this.tourDepartureId = booking.tourDepartureId ?? null;
    this.seats = booking.seats ?? null;
    this.guests = booking.guests;
    this.customerName = booking.customerName;
    this.customerEmail = booking.customerEmail;
    this.customerPhone = booking.customerPhone;
    this.totalAmount = booking.totalAmount;
    this.currency = booking.currency;
    this.notes = booking.notes ?? null;
    this.holdExpiresAt = booking.holdExpiresAt ?? null;
    this.confirmedAt = booking.confirmedAt ?? null;
    this.cancelledAt = booking.cancelledAt ?? null;
    this.completedAt = booking.completedAt ?? null;
    this.createdAt = booking.createdAt;
    this.lines = booking.lines
      ? booking.lines.map((line) => new BookingLineResponseDto(line))
      : null;
  }
}

/** Row count returned by each daily maintenance job. */
export class MaintenanceResultDto {
  affected: number;

  constructor(affected: number) {
    this.affected = affected;
  }
}
