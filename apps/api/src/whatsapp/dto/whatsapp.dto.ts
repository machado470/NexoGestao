import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min, ValidateIf } from 'class-validator'
import { WhatsAppConversationStatus, WhatsAppEntityType, WhatsAppMessageStatus, WhatsAppMessageType } from '@prisma/client'

export class ListConversationsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cursor?: string

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number
}

export class SendConversationMessageDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  content!: string

  @ApiPropertyOptional({ enum: WhatsAppMessageType })
  @IsOptional()
  @IsEnum(WhatsAppMessageType)
  messageType?: WhatsAppMessageType
}

export class SendTemplateMessageDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  conversationId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerId?: string

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  templateName!: string

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  variables?: Record<string, any>
}

export class UpdateConversationStatusDto {
  @ApiProperty({ enum: WhatsAppConversationStatus })
  @IsEnum(WhatsAppConversationStatus)
  status!: WhatsAppConversationStatus
}

export class SendMessageDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  toPhone?: string

  @ApiPropertyOptional({ enum: WhatsAppEntityType })
  @IsOptional()
  @IsEnum(WhatsAppEntityType)
  entityType?: WhatsAppEntityType

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  entityId?: string

  @ApiPropertyOptional({ enum: WhatsAppMessageType })
  @IsOptional()
  @IsEnum(WhatsAppMessageType)
  messageType?: WhatsAppMessageType

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  content!: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  idempotencyKey?: string
}

export class UpdateMessageStatusDto {
  @ApiProperty({ enum: WhatsAppMessageStatus })
  @IsEnum(WhatsAppMessageStatus)
  status!: WhatsAppMessageStatus
}

export class MessageFeedQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cursor?: string

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number
}
