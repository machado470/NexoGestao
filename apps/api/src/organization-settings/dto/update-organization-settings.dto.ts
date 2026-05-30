import { IsOptional, IsString, IsIn, IsNotEmpty } from 'class-validator';

export class UpdateOrganizationSettingsDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  timezone?: string;

  @IsOptional()
  @IsString()
  @IsIn(['BRL', 'USD', 'EUR'], { message: 'Moeda inválida. Use BRL, USD ou EUR.' })
  currency?: string;
}
