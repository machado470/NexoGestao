import { IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, IsDateString, Min } from 'class-validator'

export class CreateChargeDto {
  @IsUUID()
  @IsNotEmpty()
  customerId!: string

  @IsNumber()
  @Min(1)
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
