import { IsOptional, IsEnum, IsNumberString, IsDateString } from 'class-validator'
import { ExpenseCategory, ExpenseRecurrenceDto, ExpenseTypeDto } from './create-expense.dto'

export class ExpensesQueryDto {
  @IsNumberString()
  @IsOptional()
  page?: string

  @IsNumberString()
  @IsOptional()
  limit?: string

  @IsEnum(ExpenseCategory)
  @IsOptional()
  category?: ExpenseCategory

  @IsEnum(ExpenseTypeDto)
  @IsOptional()
  type?: ExpenseTypeDto

  @IsEnum(ExpenseRecurrenceDto)
  @IsOptional()
  recurrence?: ExpenseRecurrenceDto

  @IsDateString()
  @IsOptional()
  from?: string

  @IsDateString()
  @IsOptional()
  to?: string
}
