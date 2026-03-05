import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'
import { Org } from '../auth/decorators/org.decorator'
import { WhatsAppService } from './whatsapp.service'
import { PrismaService } from '../prisma/prisma.service'
import { WhatsAppMessageStatus } from '@prisma/client'

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
  async sendMessage(
    @Org() orgId: string,
    @Body() body: any,
  ) {
    // No mundo real, aqui chamaria o dispatcher. 
    // Para integração, usamos o queueMessage que já existe.
    return this.whatsapp.queueMessage({
      orgId,
      customerId: body.customerId,
      toPhone: body.toPhone,
      entityType: body.entityType || 'CUSTOMER',
      entityId: body.entityId || body.customerId,
      messageType: body.messageType || 'DIRECT',
      messageKey: `manual-${Date.now()}`,
      renderedText: body.content,
      metadata: body.metadata,
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
