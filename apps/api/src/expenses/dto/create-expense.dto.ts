import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsDateString,
  IsEnum,
  Max,
  Min,
  MaxLength,
  IsBoolean,
} from 'class-validator'

export enum ExpenseTypeDto {
  FIXED = 'FIXED',
  VARIABLE = 'VARIABLE',
}

export enum ExpenseRecurrenceDto {
  NONE = 'NONE',
  MONTHLY = 'MONTHLY',
}

export enum ExpenseCategory {
  HOUSING = 'HOUSING',
  ELECTRICITY = 'ELECTRICITY',
  WATER = 'WATER',
  INTERNET = 'INTERNET',
  PAYROLL = 'PAYROLL',
  MARKET = 'MARKET',
  TRANSPORT = 'TRANSPORT',
  LEISURE = 'LEISURE',
  OPERATIONS = 'OPERATIONS',
  OTHER = 'OTHER',
}

export class CreateExpenseDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string

  @IsString()
  @IsOptional()
  @MaxLength(255)
  description?: string

  @IsNumber()
  @Min(1)
  amountCents!: number

  @IsEnum(ExpenseCategory)
  category!: ExpenseCategory

  @IsEnum(ExpenseTypeDto)
  type!: ExpenseTypeDto

  @IsEnum(ExpenseRecurrenceDto)
  @IsOptional()
  recurrence?: ExpenseRecurrenceDto

  @IsDateString()
  @IsNotEmpty()
  occurredAt!: string

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(31)
  dueDay?: number

  @IsBoolean()
  @IsOptional()
  isActive?: boolean

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  notes?: string
}
