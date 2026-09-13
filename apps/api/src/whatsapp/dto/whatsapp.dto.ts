import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsArray, IsBoolean, IsEnum, IsIn, IsInt, IsISO8601, IsNotEmpty, IsOptional, IsString, Max, Min, Validate, ValidateNested, ValidatorConstraint, ValidatorConstraintInterface, ValidationArguments } from 'class-validator'
import { WhatsAppConversationStatus, WhatsAppEntityType, WhatsAppMessageStatus, WhatsAppMessageType, WhatsAppSuggestedAction, WhatsAppWebhookStatus } from '@prisma/client'

const EXECUTABLE_WHATSAPP_ACTIONS = [
  'SEND_PAYMENT_LINK', 'CONFIRM_APPOINTMENT', 'RESCHEDULE_APPOINTMENT', 'SEND_SERVICE_UPDATE',
  'ESCALATE_TO_OPERATOR', 'MARK_RESOLVED', 'REPLY_WITH_TEMPLATE',
] as const

const ENTITY_TYPES = new Set(Object.values(WhatsAppEntityType))
const TEMPLATE_KEYS = new Set(['appointment_confirmation', 'appointment_reminder', 'payment_reminder', 'payment_link', 'payment_confirmation', 'service_update', 'manual_followup'])
const TEMPLATE_CONTEXT_KEYS = new Set(['customerName', 'appointmentDate', 'appointmentTime', 'chargeAmount', 'chargeDueDate', 'paymentLink', 'serviceOrderNumber', 'companyName'])
const TARGET_KEYS = ['entityType', 'entityId'] as const
const ACTION_PAYLOAD_KEYS: Record<(typeof EXECUTABLE_WHATSAPP_ACTIONS)[number], readonly string[]> = {
  SEND_PAYMENT_LINK: [...TARGET_KEYS, 'paymentLink', 'customerName', 'chargeAmount', 'chargeDueDate'],
  CONFIRM_APPOINTMENT: [...TARGET_KEYS, 'customerName', 'appointmentDate', 'appointmentTime'],
  RESCHEDULE_APPOINTMENT: [...TARGET_KEYS, 'startsAt', 'endsAt', 'content'],
  SEND_SERVICE_UPDATE: [...TARGET_KEYS, 'customerName', 'serviceOrderNumber'],
  REPLY_WITH_TEMPLATE: [...TARGET_KEYS, 'templateKey', 'context'],
  ESCALATE_TO_OPERATOR: TARGET_KEYS,
  MARK_RESOLVED: TARGET_KEYS,
}

function nonEmptyString(value: unknown): value is string { return typeof value === 'string' && value.length > 0 }
function isoDateTime(value: unknown) { return nonEmptyString(value) && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && !Number.isNaN(Date.parse(value)) }
function validTarget(payload: Record<string, unknown>) {
  return (payload.entityType === undefined || ENTITY_TYPES.has(payload.entityType as WhatsAppEntityType))
    && (payload.entityId === undefined || payload.entityId === null || nonEmptyString(payload.entityId))
}
function validTemplateContext(value: unknown) {
  if (value === undefined) return true
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const context = value as Record<string, unknown>
  if (Object.keys(context).some(key => !TEMPLATE_CONTEXT_KEYS.has(key))) return false
  return Object.entries(context).every(([key, item]) => key === 'chargeAmount'
    ? (nonEmptyString(item) || typeof item === 'number')
    : nonEmptyString(item))
}

@ValidatorConstraint({ name: 'whatsAppActionPayload', async: false })
class WhatsAppActionPayloadConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments) {
    const action = (args.object as RequestActionExecutionDto).suggestedAction
    if (!EXECUTABLE_WHATSAPP_ACTIONS.includes(action)) return false
    if (value === undefined) return ['CONFIRM_APPOINTMENT', 'SEND_SERVICE_UPDATE', 'ESCALATE_TO_OPERATOR', 'MARK_RESOLVED'].includes(action)
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false
    const payload = value as Record<string, unknown>
    if (Object.keys(payload).some(key => !ACTION_PAYLOAD_KEYS[action].includes(key))) return false
    if (!validTarget(payload)) return false
    switch (action) {
      case 'SEND_PAYMENT_LINK':
        return nonEmptyString(payload.paymentLink) && URL.canParse(payload.paymentLink as string)
          && ['customerName', 'chargeDueDate'].every(key => payload[key] === undefined || nonEmptyString(payload[key]))
          && (payload.chargeAmount === undefined || nonEmptyString(payload.chargeAmount) || typeof payload.chargeAmount === 'number')
      case 'CONFIRM_APPOINTMENT':
        return ['customerName', 'appointmentDate', 'appointmentTime'].every(key => payload[key] === undefined || nonEmptyString(payload[key]))
      case 'RESCHEDULE_APPOINTMENT':
        return isoDateTime(payload.startsAt)
          && (payload.endsAt === undefined || isoDateTime(payload.endsAt))
          && (payload.content === undefined || nonEmptyString(payload.content))
      case 'SEND_SERVICE_UPDATE':
        return ['customerName', 'serviceOrderNumber'].every(key => payload[key] === undefined || nonEmptyString(payload[key]))
      case 'REPLY_WITH_TEMPLATE':
        return TEMPLATE_KEYS.has(payload.templateKey as WhatsAppTemplateKey) && validTemplateContext(payload.context)
      default:
        return true
    }
  }
  defaultMessage() { return 'actionPayload é incompatível com suggestedAction' }
}

export class RequestActionExecutionDto {
  @ApiProperty({ enum: EXECUTABLE_WHATSAPP_ACTIONS })
  @IsIn(EXECUTABLE_WHATSAPP_ACTIONS)
  suggestedAction!: (typeof EXECUTABLE_WHATSAPP_ACTIONS)[number]

  @ApiPropertyOptional() @IsOptional() @IsString() @IsNotEmpty() executionReason?: string
  @ApiPropertyOptional({ type: Object }) @Validate(WhatsAppActionPayloadConstraint) actionPayload?: Record<string, unknown>
  @ApiPropertyOptional() @IsOptional() @IsString() @IsNotEmpty() idempotencyKey?: string
  @ApiPropertyOptional() @IsOptional() @IsBoolean() autoExecuteSafe?: boolean
}

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

export enum WhatsAppTemplateKey {
  APPOINTMENT_CONFIRMATION = 'appointment_confirmation',
  APPOINTMENT_REMINDER = 'appointment_reminder',
  PAYMENT_REMINDER = 'payment_reminder',
  PAYMENT_LINK = 'payment_link',
  PAYMENT_CONFIRMATION = 'payment_confirmation',
  SERVICE_UPDATE = 'service_update',
  MANUAL_FOLLOWUP = 'manual_followup',
}

export class WhatsAppTemplateContextDto {
  [key: string]: unknown

  @ApiPropertyOptional() @IsOptional() @IsString() @IsNotEmpty() customerName?: string
  @ApiPropertyOptional() @IsOptional() @IsString() @IsNotEmpty() appointmentDate?: string
  @ApiPropertyOptional() @IsOptional() @IsString() @IsNotEmpty() appointmentTime?: string
  @ApiPropertyOptional() @IsOptional() @IsString() @IsNotEmpty() chargeAmount?: string
  @ApiPropertyOptional() @IsOptional() @IsString() @IsNotEmpty() chargeDueDate?: string
  @ApiPropertyOptional() @IsOptional() @IsString() @IsNotEmpty() paymentLink?: string
  @ApiPropertyOptional() @IsOptional() @IsString() @IsNotEmpty() serviceOrderNumber?: string
  @ApiPropertyOptional() @IsOptional() @IsString() @IsNotEmpty() companyName?: string
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

  @ApiProperty({ enum: WhatsAppTemplateKey })
  @IsEnum(WhatsAppTemplateKey)
  templateKey!: WhatsAppTemplateKey

  @ApiPropertyOptional({ type: WhatsAppTemplateContextDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => WhatsAppTemplateContextDto)
  context?: WhatsAppTemplateContextDto
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

export class ListWebhookEventsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  orgId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  provider?: string

  @ApiPropertyOptional({ enum: WhatsAppWebhookStatus })
  @IsOptional()
  @IsEnum(WhatsAppWebhookStatus)
  status?: WhatsAppWebhookStatus

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  traceId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  providerMessageId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  createdAtFrom?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  createdAtTo?: string

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cursor?: string
}

export class ReplayWebhookEventsDto {
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ids?: string[]

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  force?: boolean
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
