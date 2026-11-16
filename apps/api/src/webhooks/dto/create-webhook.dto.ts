import { IsArray, IsBoolean, IsNotEmpty, IsOptional, IsString, IsUrl, ArrayNotEmpty } from 'class-validator'

export class CreateWebhookDto {
  @IsUrl({ require_protocol: true, protocols: ['https'] })
  url!: string

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  events!: string[]

  @IsOptional()
  @IsBoolean()
  active?: boolean
}
