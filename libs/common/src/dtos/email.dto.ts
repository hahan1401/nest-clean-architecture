import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class SendEmailDto {
  @IsOptional()
  @IsEmail()
  from?: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsEmail({}, { each: true })
  to: string[];

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsEmail({}, { each: true })
  cc?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsEmail({}, { each: true })
  bcc?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsEmail({}, { each: true })
  replyTo?: string[];

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  subject: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  text?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50000)
  html?: string;

  @IsOptional()
  @IsString()
  configurationSetName?: string;

  @IsOptional()
  @IsString()
  requestId?: string;
}
