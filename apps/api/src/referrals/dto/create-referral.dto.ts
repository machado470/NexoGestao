import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsEmail,
  IsEnum,
  Min,
  MaxLength,
} from 'class-validator'

export enum ReferralStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  PAID = 'PAID',
}

export class CreateReferralDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  referrerName!: string

  @IsEmail()
  @IsNotEmpty()
  referrerEmail!: string

  @IsString()
  @IsOptional()
  @MaxLength(20)
  referrerPhone?: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  referredName!: string

  @IsEmail()
  @IsNotEmpty()
  referredEmail!: string

  @IsString()
  @IsOptional()
  @MaxLength(20)
  referredPhone?: string

  @IsNumber()
  @Min(0)
  @IsOptional()
  creditAmount?: number

  @IsEnum(ReferralStatus)
  @IsOptional()
  status?: ReferralStatus
}
