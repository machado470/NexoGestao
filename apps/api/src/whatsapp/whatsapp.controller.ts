import {
  Body,
  Controller,
  Get,
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
import { WhatsAppService } from './whatsapp.service'
import { PrismaService } from '../prisma/prisma.service'

@Controller('whatsapp')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WhatsAppController {
  constructor(
    private readonly whatsapp: WhatsAppService,
    private readonly prisma: PrismaService,
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
  async sendMessage(@Org() orgId: string, @Body() body: any) {
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

    return this.whatsapp.queueMessage({
      orgId,
      customerId: body.customerId,
      toPhone,
      entityType: (body.entityType || 'SERVICE_ORDER') as WhatsAppEntityType,
      entityId: body.entityId || body.customerId,
      messageType: (body.messageType ||
        'EXECUTION_CONFIRMATION') as WhatsAppMessageType,
      messageKey: `manual-${Date.now()}`,
      renderedText: String(body.content).trim(),
    })
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
