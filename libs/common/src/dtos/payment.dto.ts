import {
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';

// Body for POST /payment/generate-qr and POST /payment/generate-payment-url. Both routes
// build the same VNPay payload (QR vs. redirect URL), so they share one DTO.

export class GeneratePaymentDto {
  /** Order total in whole VND. The payment service multiplies by 100 for VNPay's wire format. */
  @IsInt()
  @IsPositive()
  amount: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  orderInfo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(45)
  ipAddr?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  orderType?: string;

  @IsOptional()
  @IsIn(['vn', 'en'])
  locale?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  bankCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  billingMobile?: string;

  @IsOptional()
  @IsEmail()
  billingEmail?: string;
}
