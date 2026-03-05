import { IsOptional, IsEnum, IsNumberString, IsDateString } from 'class-validator'
import { ExpenseCategory } from './create-expense.dto'

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

  @IsDateString()
  @IsOptional()
  from?: string

  @IsDateString()
  @IsOptional()
  to?: string
}
