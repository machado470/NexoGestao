import { IsBoolean, IsEmail, IsOptional, IsString, MaxLength } from 'class-validator'

export class UpdateCustomerDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string

  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  email?: string | null

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null

  @IsOptional()
  @IsBoolean()
  active?: boolean

  @IsOptional()
  @IsString()
  expectedUpdatedAt?: string
}
