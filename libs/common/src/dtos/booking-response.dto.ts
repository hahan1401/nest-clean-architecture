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
  RoomImage,
  Tour,
  TourDeparture,
  TourImage,
} from '@app/database';

/**
 * Every temporal field leaves the API as a full ISO 8601 instant, the same shape
 * it arrives in. There is no date-only half of this contract any more: a
 * departure has an hour, a stay has an arrival time, and a price-rule window has
 * two ends that are instants like everything else.
 */
const toIso = (value: Date | null | undefined): string | null =>
  value ? value.toISOString() : null;

/** One symbolic picture. Only the external store URL is ever returned, never bytes. */
export class RoomImageResponseDto {
  id: number;
  url: string;
  position: number;
  caption: string | null;

  constructor(image: RoomImage) {
    this.id = image.id;
    this.url = image.url;
    this.position = image.position;
    this.caption = image.caption ?? null;
  }
}

export class TourImageResponseDto {
  id: number;
  url: string;
  position: number;
  caption: string | null;

  constructor(image: TourImage) {
    this.id = image.id;
    this.url = image.url;
    this.position = image.position;
    this.caption = image.caption ?? null;
  }
}

export class RoomResponseDto {
  id: number;
  code: string;
  name: string;
  description: string | null;
  maxGuests: number;
  basePrice: number;
  isActive: boolean;
  /** Ascending by position. Empty, never omitted, when the room has none. */
  images: RoomImageResponseDto[];

  constructor(room: Room) {
    this.id = room.id;
    this.code = room.code;
    this.name = room.name;
    this.description = room.description ?? null;
    this.maxGuests = room.maxGuests;
    this.basePrice = room.basePrice;
    this.isActive = room.isActive;
    this.images = (room.images ?? []).map((image) => new RoomImageResponseDto(image));
  }
}

export class PriceQuoteLineResponseDto {
  date: string | null;
  quantity: number;
  unitAmount: number;
  amount: number;
  source: PriceSource;
  priceRuleId: number | null;

  constructor(line: PriceQuoteLine) {
    this.date = toIso(line.date);
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

/**
 * Why a room can or cannot be taken for a window. ON_HOLD means another guest is
 * mid-checkout: not bookable now, but not sold either.
 */
export type RoomAvailabilityState = 'AVAILABLE' | 'ON_HOLD' | 'BOOKED';

/** A room paired with whether it is free for the requested window, and at what price. */
export class RoomAvailabilityResponseDto {
  room: RoomResponseDto;
  /** True only for AVAILABLE. Branch on `state` when you need to tell held from sold. */
  available: boolean;
  state: RoomAvailabilityState;
  /** ISO instant the blocking hold lapses; null unless `state` is ON_HOLD. */
  heldUntil: string | null;
  /** ISO instant the room is free again; null unless `state` is BOOKED. */
  availableFrom: string | null;
  quote: PriceQuoteResponseDto | null;

  constructor(
    room: Room,
    state: RoomAvailabilityState,
    quote: PriceQuote | null,
    heldUntil: Date | null = null,
    availableFrom: Date | null = null,
  ) {
    this.room = new RoomResponseDto(room);
    this.available = state === 'AVAILABLE';
    this.state = state;
    this.heldUntil = toIso(heldUntil);
    this.availableFrom = toIso(availableFrom);
    this.quote = quote ? new PriceQuoteResponseDto(quote) : null;
  }
}

export class TourResponseDto {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  durationDays: number;
  basePricePerPerson: number;
  isActive: boolean;
  /** Ascending by position. Empty, never omitted, when the tour has none. */
  images: TourImageResponseDto[];

  constructor(tour: Tour) {
    this.id = tour.id;
    this.slug = tour.slug;
    this.name = tour.name;
    this.description = tour.description ?? null;
    this.durationDays = tour.durationDays;
    this.basePricePerPerson = tour.basePricePerPerson;
    this.isActive = tour.isActive;
    this.images = (tour.images ?? []).map((image) => new TourImageResponseDto(image));
  }
}

export class TourDepartureResponseDto {
  id: number;
  tourId: number;
  departureDate: string | null;
  capacity: number;
  bookedSeats: number;
  remainingSeats: number;
  priceOverride: number | null;
  status: DepartureStatus;

  constructor(departure: TourDeparture) {
    this.id = departure.id;
    this.tourId = departure.tourId;
    this.departureDate = toIso(departure.departureDate);
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
  id: number;
  name: string;
  roomId: number | null;
  tourId: number | null;
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
    this.startDate = toIso(rule.startDate);
    this.endDate = toIso(rule.endDate);
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
    this.date = toIso(line.lineDate);
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
  id: number;
  reference: string;
  type: BookableType;
  status: BookingStatus;

  roomId: number | null;
  /**
   * The instants the guest picked, ISO 8601. The site defaults to 13:00 arrival
   * and 11:00 departure on the house clock; these are what the house actually
   * holds, and they read back in exactly the shape they were sent.
   */
  checkIn: string | null;
  checkOut: string | null;

  tourDepartureId: number | null;
  seats: number | null;

  guests: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;

  totalAmount: number;
  currency: string;
  notes: string | null;

  holdExpiresAt: string | null;
  confirmedAt: string | null;
  cancelledAt: string | null;
  completedAt: string | null;
  createdAt: string;

  lines: BookingLineResponseDto[] | null;

  constructor(booking: Booking) {
    this.id = booking.id;
    this.reference = booking.reference;
    this.type = booking.type;
    this.status = booking.status;
    this.roomId = booking.roomId ?? null;
    this.checkIn = toIso(booking.checkIn);
    this.checkOut = toIso(booking.checkOut);
    this.tourDepartureId = booking.tourDepartureId ?? null;
    this.seats = booking.seats ?? null;
    this.guests = booking.guests;
    this.customerName = booking.customerName;
    this.customerEmail = booking.customerEmail;
    this.customerPhone = booking.customerPhone;
    this.totalAmount = booking.totalAmount;
    this.currency = booking.currency;
    this.notes = booking.notes ?? null;
    this.holdExpiresAt = toIso(booking.holdExpiresAt);
    this.confirmedAt = toIso(booking.confirmedAt);
    this.cancelledAt = toIso(booking.cancelledAt);
    this.completedAt = toIso(booking.completedAt);
    this.createdAt = booking.createdAt.toISOString();
    this.lines = booking.lines
      ? booking.lines.map((line) => new BookingLineResponseDto(line))
      : null;
  }
}
