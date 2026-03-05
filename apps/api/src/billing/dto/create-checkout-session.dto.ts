import { IsEnum, IsOptional, IsString, IsUrl } from 'class-validator'
import { PlanName } from '@prisma/client'

export class CreateCheckoutSessionDto {
  @IsEnum(PlanName)
  planName: PlanName

  @IsOptional()
  @IsString()
  successUrl?: string

  @IsOptional()
  @IsString()
  cancelUrl?: string
}
