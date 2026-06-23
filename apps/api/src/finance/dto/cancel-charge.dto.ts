import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator'

export class CancelChargeDto {
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  cancellationReason!: string

  @IsString()
  @IsOptional()
  expectedUpdatedAt?: string
}
