import { IsOptional, IsString, IsIn } from 'class-validator';

export class UpdateOrganizationSettingsDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsString()
  @IsIn(['BRL', 'USD', 'EUR'], { message: 'Moeda inválida. Use BRL, USD ou EUR.' })
  currency?: string;
}
