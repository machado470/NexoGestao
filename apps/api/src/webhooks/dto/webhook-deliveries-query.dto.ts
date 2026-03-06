import { IsOptional, IsString } from 'class-validator'

export class WebhookDeliveriesQueryDto {
  @IsOptional()
  @IsString()
  eventType?: string

  @IsOptional()
  @IsString()
  status?: 'PENDING' | 'SUCCESS' | 'FAILED'
}
