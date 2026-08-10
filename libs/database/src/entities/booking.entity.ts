import { BookableType, BookingStatus, DepartureStatus, PriceSource } from '@prisma/client';

// Re-exported so apps never import @prisma/client directly.
export { BookableType, BookingStatus, DepartureStatus, PriceSource };

export class Room {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  maxGuests: number;
  /** Nightly rate in whole VND. */
  basePrice: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;

  constructor(partial: Partial<Room>) {
    Object.assign(this, partial);
  }
}

export class Tour {
  id: number;
  slug: string;
  name: string;
  description?: string | null;
  durationDays: number;
  /** Per-person price in whole VND. */
  basePricePerPerson: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;

  constructor(partial: Partial<Tour>) {
    Object.assign(this, partial);
  }
}

export class TourDeparture {
  id: number;
  tourId: number;
  departureDate: Date;
  capacity: number;
  bookedSeats: number;
  /** Per-departure price per person in whole VND; beats any PriceRule when set. */
  priceOverride?: number | null;
  status: DepartureStatus;
  createdAt: Date;
  updatedAt: Date;

  constructor(partial: Partial<TourDeparture>) {
    Object.assign(this, partial);
  }
}

/** A departure joined with its tour's name and its remaining seat count. */
export class AvailableDeparture extends TourDeparture {
  tourName: string;
  remainingSeats: number;
  /** Display price per person; the authoritative price comes from the pricing port. */
  pricePerPerson: number;

  constructor(partial: Partial<AvailableDeparture>) {
    super(partial);
    Object.assign(this, partial);
  }
}

export class PriceRule {
  id: number;
  name: string;
  roomId?: number | null;
  tourId?: number | null;
  startDate?: Date | null;
  endDate?: Date | null;
  /** Postgres DOW numbering: 0 = Sunday .. 6 = Saturday. Empty = every day. */
  daysOfWeek: number[];
  /** Overriding price in whole VND. */
  amount: number;
  priority: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;

  constructor(partial: Partial<PriceRule>) {
    Object.assign(this, partial);
  }
}

export class BookingLine {
  id: number;
  bookingId: number;
  lineDate: Date;
  quantity: number;
  unitAmount: number;
  amount: number;
  priceSource: PriceSource;
  priceRuleId?: number | null;
  createdAt: Date;

  constructor(partial: Partial<BookingLine>) {
    Object.assign(this, partial);
  }
}

/**
 * One resolved unit of price: a stay night for rooms, the departure for tours.
 * This is the shape that gets frozen into BookingLine rows at booking time.
 */
export class PriceQuoteLine {
  /** UTC midnight, matching how Prisma materialises @db.Date columns. */
  date: Date;
  /** 1 per night for rooms; the seat count for tours. */
  quantity: number;
  unitAmount: number;
  amount: number;
  source: PriceSource;
  priceRuleId: number | null;

  constructor(partial: Partial<PriceQuoteLine>) {
    Object.assign(this, partial);
  }
}

export class PriceQuote {
  currency: string;
  lines: PriceQuoteLine[];
  total: number;

  constructor(partial: Partial<PriceQuote>) {
    Object.assign(this, partial);
  }
}

export class Booking {
  id: number;
  reference: string;
  /** Bearer credential for the cancel link. Never expose it in list responses. */
  cancellationToken: string;
  type: BookableType;
  status: BookingStatus;

  roomId?: number | null;
  checkIn?: Date | null;
  checkOut?: Date | null;

  tourDepartureId?: number | null;
  seats?: number | null;

  guests: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;

  /** Frozen grand total in whole VND. */
  totalAmount: number;
  currency: string;

  notes?: string | null;
  holdExpiresAt?: Date | null;
  confirmedAt?: Date | null;
  cancelledAt?: Date | null;
  completedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;

  lines?: BookingLine[];

  constructor(partial: Partial<Booking>) {
    Object.assign(this, partial);
  }
}
