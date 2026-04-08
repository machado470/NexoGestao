import { Body, Controller, Post } from '@nestjs/common'
import { WhatsAppEntityType, WhatsAppMessageType } from '@prisma/client'
import { WhatsAppService, buildDeterministicMessageKey } from './whatsapp.service'

@Controller('whatsapp/test')
export class WhatsAppTestController {
  constructor(private readonly whatsapp: WhatsAppService) {}

  @Post('queue')
  async queue(@Body() body: any) {
    const entityType = (body.entityType || 'SERVICE_ORDER') as WhatsAppEntityType
    const entityId = body.entityId || body.customerId
    const messageType = (body.messageType || 'EXECUTION_CONFIRMATION') as WhatsAppMessageType

    return this.whatsapp.queueMessage({
      orgId: body.orgId,
      customerId: body.customerId,
      toPhone: body.toPhone,
      entityType,
      entityId,
      messageType,
      messageKey:
        body.messageKey ||
        buildDeterministicMessageKey({
          entityType,
          entityId,
          messageType,
        }),
      renderedText: body.renderedText || body.content || 'Mensagem de teste',
    })
  }
}
