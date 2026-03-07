import { IsNotEmpty, IsString, IsNumber, IsJSON, IsOptional } from 'class-validator';

export class CreatePlanDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  description?: string;

  @IsNotEmpty()
  @IsNumber()
  priceCents: number;

  @IsOptional()
  @IsJSON()
  features?: string;
}
