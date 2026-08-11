import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { IsIsoInstant } from './is-iso-instant.decorator';

// Every date crosses the wire as a full ISO 8601 instant
// ("2027-02-14T06:00:00.000Z"), never as a calendar date. See `IsIsoInstant`
// for why the zone is mandatory.

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
  @IsIsoInstant()
  departureDate: string;

  @IsInt()
  @Min(1)
  capacity: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  priceOverride?: number;
}

/**
 * Adds one image to a Room or a Tour. The backend never stores or proxies
 * image bytes - `url` must already point at the external object store
 * (S3, Cloudinary, ...). Shared between rooms and tours since the shape is
 * identical; which owner it attaches to comes from the route, not the body.
 */
export class AddImageDto {
  @IsUrl({}, { message: 'url must be a valid absolute URL' })
  @MaxLength(2000)
  url: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  caption?: string;

  /** Appended after the current highest position when omitted. */
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}

/**
 * The full, new display order for an owner's images: every current image id,
 * each exactly once. The service rejects a partial or foreign list rather
 * than guessing what to do with it.
 */
export class ReorderImagesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  imageIds: number[];
}

export class CreatePriceRuleDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  /** Exactly one of roomId / tourId must be set; the service enforces it. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  roomId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  tourId?: number;

  @IsOptional()
  @IsIsoInstant()
  startDate?: string;

  @IsOptional()
  @IsIsoInstant()
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
  @Type(() => Number)
  @IsInt()
  @Min(1)
  roomId?: number;

  @IsOptional()
  @IsIsoInstant()
  checkIn?: string;

  @IsOptional()
  @IsIsoInstant()
  checkOut?: string;

  // TOUR fields
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  tourDepartureId?: number;

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
  @Type(() => Number)
  @IsInt()
  @Min(1)
  roomId?: number;

  @IsOptional()
  @IsIsoInstant()
  checkIn?: string;

  @IsOptional()
  @IsIsoInstant()
  checkOut?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  tourDepartureId?: number;

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
