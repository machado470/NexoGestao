import { Body, Controller, Post } from '@nestjs/common'
import { WhatsAppEntityType, WhatsAppMessageType } from '@prisma/client'
import { WhatsAppService } from './whatsapp.service'

@Controller('whatsapp/test')
export class WhatsAppTestController {
  constructor(private readonly whatsapp: WhatsAppService) {}

  @Post('queue')
  async queue(@Body() body: any) {
    return this.whatsapp.queueMessage({
      orgId: body.orgId,
      customerId: body.customerId,
      toPhone: body.toPhone,
      entityType: (body.entityType || 'SERVICE_ORDER') as WhatsAppEntityType,
      entityId: body.entityId || body.customerId,
      messageType: (body.messageType || 'EXECUTION_CONFIRMATION') as WhatsAppMessageType,
      messageKey: body.messageKey || `test-${Date.now()}`,
      renderedText: body.renderedText || body.content || 'Mensagem de teste',
    })
  }
}
