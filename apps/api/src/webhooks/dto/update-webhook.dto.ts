import { IsArray, IsBoolean, IsOptional, IsString, IsUrl } from 'class-validator'

export class UpdateWebhookDto {
  @IsOptional()
  @IsUrl({ require_protocol: true })
  url?: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  events?: string[]

  @IsOptional()
  @IsBoolean()
  active?: boolean
}
