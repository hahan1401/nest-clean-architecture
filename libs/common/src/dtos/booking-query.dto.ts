import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { IsIsoInstant } from './is-iso-instant.decorator';

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
  @IsIsoInstant()
  from: string;

  @IsIsoInstant()
  to: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  guests?: number;
}

export class TourAvailabilityQueryDto {
  @IsIsoInstant()
  from: string;

  @IsIsoInstant()
  to: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  seats?: number;
}

export class DepartureListQueryDto {
  @IsOptional()
  @IsIsoInstant()
  from?: string;

  @IsOptional()
  @IsIsoInstant()
  to?: string;
}

export class BookingHistoryQueryDto extends ListRangeQueryDto {
  @IsOptional()
  @IsIn(['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'EXPIRED'])
  status?: 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED';

  @IsOptional()
  @IsIsoInstant()
  from?: string;

  @IsOptional()
  @IsIsoInstant()
  to?: string;
}

export class PriceRuleListQueryDto {
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
}
