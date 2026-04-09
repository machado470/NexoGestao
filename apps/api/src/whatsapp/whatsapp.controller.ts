import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  UseGuards,
  BadRequestException,
} from '@nestjs/common'
import {
  WhatsAppEntityType,
  WhatsAppMessageStatus,
  WhatsAppMessageType,
} from '@prisma/client'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'
import { Org } from '../auth/decorators/org.decorator'
import { WhatsAppService, buildDeterministicMessageKey } from './whatsapp.service'
import { PrismaService } from '../prisma/prisma.service'
import { QuotasService } from '../quotas/quotas.service'
import { IdempotencyService } from '../common/idempotency/idempotency.service'

@Controller('whatsapp')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WhatsAppController {
  constructor(
    private readonly whatsapp: WhatsAppService,
    private readonly prisma: PrismaService,
    private readonly quotas: QuotasService,
    private readonly idempotency: IdempotencyService,
  ) {}

  @Get('messages/:customerId')
  @Roles('ADMIN')
  async getMessages(
    @Org() orgId: string,
    @Param('customerId') customerId: string,
  ) {
    return this.prisma.whatsAppMessage.findMany({
      where: { orgId, customerId },
      orderBy: { createdAt: 'desc' },
    })
  }

  @Post('messages')
  @Roles('ADMIN')
  async sendMessage(
    @Org() orgId: string,
    @Headers('idempotency-key') idempotencyKeyHeader: string | undefined,
    @Body() body: any,
  ) {
    await this.quotas.validateQuota(orgId, 'SEND_MESSAGE')

    if (!body?.customerId) {
      throw new BadRequestException('customerId é obrigatório')
    }

    if (!body?.content || !String(body.content).trim()) {
      throw new BadRequestException('content é obrigatório')
    }

    const customer = await this.prisma.customer.findFirst({
      where: {
        id: body.customerId,
        orgId,
      },
      select: {
        id: true,
        phone: true,
      },
    })

    if (!customer) {
      throw new BadRequestException('Cliente não encontrado')
    }

    const toPhone =
      String(body?.toPhone ?? '').trim() ||
      String(body?.receiverNumber ?? '').trim() ||
      String(customer.phone ?? '').trim()

    if (!toPhone) {
      throw new BadRequestException(
        'Telefone do cliente não encontrado para envio de WhatsApp',
      )
    }

    const entityType =
      (body.entityType || 'SERVICE_ORDER') as WhatsAppEntityType
    const entityId = body.entityId || body.customerId
    const messageType =
      (body.messageType || 'EXECUTION_CONFIRMATION') as WhatsAppMessageType

    const requestPayload = {
      customerId: body.customerId,
      toPhone,
      entityType,
      entityId,
      messageType,
      content: String(body.content).trim(),
    }
    const idempotencyKey =
      String(body?.idempotencyKey ?? idempotencyKeyHeader ?? '').trim() ||
      buildDeterministicMessageKey({
        entityType,
        entityId,
        messageType,
      })
    const idem = await this.idempotency.begin({
      orgId,
      scope: 'whatsapp.send_message',
      idempotencyKey,
      payload: requestPayload,
    })
    if (idem.mode === 'replay') {
      return idem.response
    }

    try {
      const result = await this.whatsapp.enqueueMessage({
      orgId,
      customerId: body.customerId,
      toPhone,
      entityType,
      entityId,
      messageType,
      messageKey: buildDeterministicMessageKey({
        entityType,
        entityId,
        messageType,
      }),
      renderedText: String(body.content).trim(),
    })
      await this.idempotency.complete(idem.recordId, result)
      return result
    } catch (error: any) {
      await this.idempotency.fail(idem.recordId, error?.code)
      throw error
    }
  }

  @Patch('messages/:id/status')
  @Roles('ADMIN')
  async updateStatus(
    @Org() orgId: string,
    @Param('id') id: string,
    @Body('status') status: WhatsAppMessageStatus,
  ) {
    return this.prisma.whatsAppMessage.updateMany({
      where: { id, orgId },
      data: { status },
    })
  }
}
