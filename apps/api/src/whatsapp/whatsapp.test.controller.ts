// apps/api/src/whatsapp/whatsapp.test.controller.ts

import { Body, Controller, Post } from '@nestjs/common'
import { WhatsAppEntityType, WhatsAppMessageType } from '@prisma/client'
import { WhatsAppService } from './whatsapp.service'

type TestQueueDto = {
  orgId: string
  customerId: string
  toPhone: string

  entityType?: WhatsAppEntityType
  entityId?: string
  messageType?: WhatsAppMessageType

  // opcional: se não vier, a API gera um bucket por dia
  bucket?: string // ex: 2026-02-26
}

@Controller('whatsapp/test')
export class WhatsAppTestController {
  constructor(private readonly whatsApp: WhatsAppService) {}

  @Post('queue')
  async queue(@Body() dto: TestQueueDto) {
    const entityType = dto.entityType ?? WhatsAppEntityType.APPOINTMENT
    const entityId = dto.entityId ?? 'demo-appointment-1'
    const messageType = dto.messageType ?? WhatsAppMessageType.APPOINTMENT_CONFIRMATION

    const bucket = (dto.bucket ?? new Date().toISOString().slice(0, 10)).trim()

    const messageKey = `${dto.orgId}:${messageType}:${entityType}:${entityId}:${bucket}`

    const renderedText = '✅ Confirmação: seu agendamento está marcado. Responda 1 para CONFIRMAR.'

    return this.whatsApp.queueMessage({
      orgId: dto.orgId,
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
