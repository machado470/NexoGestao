import { IsNotEmpty, IsEnum, IsNumber, IsJSON, IsOptional } from 'class-validator';
import { PlanName } from '@prisma/client';

export class CreatePlanDto {
  @IsNotEmpty()
  @IsEnum(PlanName)
  name: PlanName;

  @IsOptional()
  description?: string;

  @IsNotEmpty()
  @IsNumber()
  priceCents: number;

  @IsOptional()
  @IsJSON()
  features?: string; // JSON string for features
}
