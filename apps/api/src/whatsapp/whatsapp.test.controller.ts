import {
  Body,
  Controller,
  ForbiddenException,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common'
import { WhatsAppEntityType, WhatsAppMessageType } from '@prisma/client'
import { Roles } from '../auth/decorators/roles.decorator'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { WhatsAppService } from './whatsapp.service'

type TestQueueDto = {
  customerId: string
  toPhone: string
  entityType?: WhatsAppEntityType
  entityId?: string
  messageType?: WhatsAppMessageType
  bucket?: string
}

@Controller('whatsapp/test')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class WhatsAppTestController {
  constructor(private readonly whatsApp: WhatsAppService) {}

  @Post('queue')
  async queue(@Request() req: any, @Body() dto: TestQueueDto) {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException('Endpoint de teste desabilitado em produção.')
    }

    const orgId = req?.user?.orgId
    if (!orgId) {
      throw new ForbiddenException('Contexto da organização ausente.')
    }

    const entityType = dto.entityType ?? WhatsAppEntityType.APPOINTMENT
    const entityId = dto.entityId ?? 'demo-appointment-1'
    const messageType =
      dto.messageType ?? WhatsAppMessageType.APPOINTMENT_CONFIRMATION

    const bucket = (dto.bucket ?? new Date().toISOString().slice(0, 10)).trim()

    const messageKey = `${orgId}:${messageType}:${entityType}:${entityId}:${bucket}`

    const renderedText =
      '✅ Confirmação: seu agendamento está marcado. Responda 1 para CONFIRMAR.'

    return this.whatsApp.queueMessage({
      orgId,
      customerId: dto.customerId,
      toPhone: dto.toPhone,
      entityType,
      entityId,
      messageType,
      messageKey,
      templateKey: null,
      renderedText,
      metadata: { source: 'http_test', bucket },
    })
  }
}
