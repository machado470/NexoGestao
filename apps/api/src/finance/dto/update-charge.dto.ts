import { IsOptional, IsString, IsNumber, IsDateString, IsIn, Min } from 'class-validator'

const ALLOWED_STATUSES = ['CANCELED'] as const

export class UpdateChargeDto {
  @IsNumber()
  @Min(1)
  @IsOptional()
  amountCents?: number

  @IsDateString()
  @IsOptional()
  dueDate?: string

  @IsString()
  @IsOptional()
  @IsIn(ALLOWED_STATUSES as unknown as string[])
  status?: (typeof ALLOWED_STATUSES)[number]

  @IsString()
  @IsOptional()
  notes?: string

  @IsString()
  @IsOptional()
  expectedUpdatedAt?: string
}
