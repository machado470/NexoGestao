import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsDateString,
  IsEnum,
  Min,
  MaxLength,
} from 'class-validator'

export enum LaunchType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
  TRANSFER = 'TRANSFER',
}

export class CreateLaunchDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  description!: string

  @IsNumber()
  @Min(1)
  amountCents!: number

  @IsEnum(LaunchType)
  type!: LaunchType

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  category!: string

  @IsString()
  @IsOptional()
  @MaxLength(100)
  account?: string

  @IsDateString()
  @IsNotEmpty()
  date!: string

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  notes?: string
}
