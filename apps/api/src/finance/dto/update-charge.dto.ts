import { IsOptional, IsString, IsInt, IsDateString, IsIn, Min, Max } from 'class-validator'

const ALLOWED_STATUSES = ['CANCELED'] as const

export class UpdateChargeDto {
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
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
