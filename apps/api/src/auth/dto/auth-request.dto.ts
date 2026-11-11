import { Transform, type TransformFnParams } from 'class-transformer'
import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator'

// The application's global pipe enables implicit conversion. Inspect the raw
// property so numbers/arrays cannot become valid credentials or names first.
const plainValue = ({ obj, key }: TransformFnParams) => obj[key]
const trim = (params: TransformFnParams) => {
  const value = plainValue(params)
  return typeof value === 'string' ? value.trim() : value
}

export class AuthEmailDto {
  @Transform(trim)
  @IsString()
  @IsEmail()
  @MaxLength(254)
  email!: string
}

export class RegisterDto extends AuthEmailDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  orgName!: string

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  adminName!: string

  @Transform(plainValue)
  @IsString()
  @MinLength(8)
  @MaxLength(1024)
  password!: string
}

export class LoginDto extends AuthEmailDto {
  // Existing accounts may have passwords shorter than today's registration rule.
  @Transform(plainValue)
  @IsString()
  @IsNotEmpty()
  @MaxLength(1024)
  password!: string
}

export class AuthTokenDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  token!: string
}

export class ResetPasswordDto extends AuthTokenDto {
  @Transform(plainValue)
  @IsString()
  @MinLength(8)
  @MaxLength(1024)
  password!: string
}
