import { IsNotEmpty, IsEnum, IsOptional } from 'class-validator';
import { PlanName } from '@prisma/client';

export class CreateSubscriptionDto {
  @IsNotEmpty()
  @IsEnum(PlanName)
  planName: PlanName;

  @IsOptional()
  @IsNotEmpty()
  orgId?: string; // Usado internamente para criar a primeira assinatura
}
