import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/**
 * Calendar dates cross the wire as date-only ISO strings ("2027-02-14"), never as
 * full timestamps. The service parses them to UTC midnight, matching how Prisma
 * materialises @db.Date columns.
 */
const DATE_ONLY = { strict: true } as const;

export class CreateRoomDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  code: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsInt()
  @Min(1)
  @Max(50)
  maxGuests: number;

  /** Nightly rate in whole VND. */
  @IsInt()
  @Min(0)
  basePrice: number;
}

export class CreateTourDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  slug: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsInt()
  @Min(1)
  durationDays: number;

  /** Per-person price in whole VND. */
  @IsInt()
  @Min(0)
  basePricePerPerson: number;
}

export class CreateTourDepartureDto {
  @IsDateString(DATE_ONLY)
  departureDate: string;

  @IsInt()
  @Min(1)
  capacity: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  priceOverride?: number;
}

export class CreatePriceRuleDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  /** Exactly one of roomId / tourId must be set; the service enforces it. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  roomId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  tourId?: string;

  @IsOptional()
  @IsDateString(DATE_ONLY)
  startDate?: string;

  @IsOptional()
  @IsDateString(DATE_ONLY)
  endDate?: string;

  /** Postgres DOW numbering: 0 = Sunday .. 6 = Saturday. Empty = every day. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(7)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  daysOfWeek?: number[];

  @IsInt()
  @Min(0)
  amount: number;

  @IsOptional()
  @IsInt()
  priority?: number;
}

export class BookingCustomerDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  phone: string;
}

export class CreateBookingDto {
  @IsIn(['ROOM', 'TOUR'])
  type: 'ROOM' | 'TOUR';

  // ROOM fields
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  roomId?: string;

  @IsOptional()
  @IsDateString(DATE_ONLY)
  checkIn?: string;

  @IsOptional()
  @IsDateString(DATE_ONLY)
  checkOut?: string;

  // TOUR fields
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  tourDepartureId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  seats?: number;

  @IsInt()
  @Min(1)
  guests: number;

  @ValidateNested()
  @Type(() => BookingCustomerDto)
  customer: BookingCustomerDto;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class QuotePriceDto {
  @IsIn(['ROOM', 'TOUR'])
  type: 'ROOM' | 'TOUR';

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  roomId?: string;

  @IsOptional()
  @IsDateString(DATE_ONLY)
  checkIn?: string;

  @IsOptional()
  @IsDateString(DATE_ONLY)
  checkOut?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  tourDepartureId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  seats?: number;
}

export class CancelBookingDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
