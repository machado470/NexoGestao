import { IsDateString, IsIn, IsInt, Min, Max, IsOptional, IsString, MaxLength } from 'class-validator'

const PAYMENT_METHODS = ['PIX', 'CASH', 'CARD', 'TRANSFER', 'OTHER'] as const

export class CreatePaymentDto {
  @IsIn(PAYMENT_METHODS as unknown as string[])
  method!: (typeof PAYMENT_METHODS)[number]

  @IsInt()
  @Min(1)
  @Max(1_000_000_000)
  amountCents!: number

  @IsDateString()
  @IsOptional()
  paidAt?: string

  @IsString()
  @MaxLength(2000)
  @IsOptional()
  notes?: string

  @IsString()
  @IsOptional()
  idempotencyKey?: string
}
