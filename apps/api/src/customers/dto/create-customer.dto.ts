import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator'

export class CreateCustomerDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string

  // aceita qualquer string, normalização (dígitos) fica no service
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  phone!: string

  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  email?: string

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string
}
