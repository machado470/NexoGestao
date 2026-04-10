import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator'

export class UpsertFeatureOverrideDto {
  @IsBoolean()
  enabled!: boolean

  @IsOptional()
  @IsString()
  @MaxLength(280)
  reason?: string
}
