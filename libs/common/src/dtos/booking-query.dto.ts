import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

const DATE_ONLY = { strict: true } as const;

/** Query DTOs rely on ValidationPipe({ transform: true }) to coerce the strings. */
export class ListRangeQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  take?: number;
}

export class RoomListQueryDto extends ListRangeQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  guests?: number;
}

export class TourListQueryDto extends ListRangeQueryDto {}

export class RoomAvailabilityQueryDto extends ListRangeQueryDto {
  @IsDateString(DATE_ONLY)
  from: string;

  @IsDateString(DATE_ONLY)
  to: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  guests?: number;
}

export class TourAvailabilityQueryDto {
  @IsDateString(DATE_ONLY)
  from: string;

  @IsDateString(DATE_ONLY)
  to: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  seats?: number;
}

export class DepartureListQueryDto {
  @IsOptional()
  @IsDateString(DATE_ONLY)
  from?: string;

  @IsOptional()
  @IsDateString(DATE_ONLY)
  to?: string;
}

export class BookingHistoryQueryDto extends ListRangeQueryDto {
  @IsOptional()
  @IsIn(['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'EXPIRED'])
  status?: 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED';

  @IsOptional()
  @IsDateString(DATE_ONLY)
  from?: string;

  @IsOptional()
  @IsDateString(DATE_ONLY)
  to?: string;
}

export class PriceRuleListQueryDto {
  @IsOptional()
  @IsString()
  roomId?: string;

  @IsOptional()
  @IsString()
  tourId?: string;
}
