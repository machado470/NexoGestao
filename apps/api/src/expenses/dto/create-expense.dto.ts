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

export enum ExpenseCategory {
  OPERATIONAL = 'OPERATIONAL',
  MARKETING = 'MARKETING',
  INFRASTRUCTURE = 'INFRASTRUCTURE',
  PAYROLL = 'PAYROLL',
  TAXES = 'TAXES',
  SUPPLIES = 'SUPPLIES',
  TRAVEL = 'TRAVEL',
  OTHER = 'OTHER',
}

export class CreateExpenseDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  description!: string

  @IsNumber()
  @Min(1)
  amountCents!: number

  @IsEnum(ExpenseCategory)
  @IsOptional()
  category?: ExpenseCategory

  @IsDateString()
  @IsNotEmpty()
  date!: string

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  notes?: string
}
