import {
  IsNotEmpty,
  Matches,
  IsInt,
  IsOptional,
  ValidateIf,
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
  @Matches(/\S/, { message: "O texto deve conter caracteres além de espaços" })
  @MaxLength(255)
  title!: string

  @IsString()
  @IsOptional()
  @MaxLength(255)
  description?: string

  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  amountCents!: number

  @IsEnum(ExpenseCategory)
  category!: ExpenseCategory

  @IsEnum(ExpenseTypeDto)
  type!: ExpenseTypeDto

  @IsEnum(ExpenseRecurrenceDto)
  @ValidateIf((_object, value) => value !== undefined)
  recurrence?: ExpenseRecurrenceDto

  @IsDateString()
  @IsNotEmpty()
  occurredAt!: string

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  dueDay?: number

  @IsBoolean()
  @ValidateIf((_object, value) => value !== undefined)
  isActive?: boolean

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  notes?: string
}
