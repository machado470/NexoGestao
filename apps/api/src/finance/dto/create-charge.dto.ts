import { IsNotEmpty, IsInt, IsOptional, IsString, IsUUID, IsDateString, Min, Max } from 'class-validator'

export class CreateChargeDto {
  @IsUUID()
  @IsNotEmpty()
  customerId!: string

  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  amountCents!: number

  @IsDateString()
  @IsNotEmpty()
  dueDate!: string

  @IsString()
  @IsOptional()
  notes?: string

  @IsUUID()
  @IsOptional()
  serviceOrderId?: string

  @IsString()
  @IsOptional()
  idempotencyKey?: string
}
