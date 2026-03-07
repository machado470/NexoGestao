import { IsString, IsOptional } from 'class-validator'

export class CreateCheckoutSessionDto {
  @IsString()
  priceId!: string

  @IsOptional()
  @IsString()
  successUrl?: string

  @IsOptional()
  @IsString()
  cancelUrl?: string
}
