import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common'
import { WhatsAppConversationStatus, WhatsAppMessageStatus } from '@prisma/client'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'
import { Org } from '../auth/decorators/org.decorator'
import { User } from '../auth/decorators/user.decorator'
import { IdempotencyService } from '../common/idempotency/idempotency.service'
import { QuotasService } from '../quotas/quotas.service'
import { createWhatsAppProvider, getWhatsAppProviderReadiness } from './providers/provider.factory'
import { WhatsAppService, buildDeterministicMessageKey } from './whatsapp.service'

@Controller('whatsapp')
export class WhatsAppController {
  constructor(
    private readonly whatsapp: WhatsAppService,
    private readonly quotas: QuotasService,
    private readonly idempotency: IdempotencyService,
  ) {}

  @Get('conversations')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async listConversations(@Org() orgId: string, @Query() query: any) {
    return this.whatsapp.listConversations(orgId, query)
  }

  @Get('conversations/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async getConversation(@Org() orgId: string, @Param('id') id: string) {
    return this.whatsapp.getConversation(orgId, id)
  }

  @Get('conversations/:id/messages')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async getConversationMessages(@Org() orgId: string, @Param('id') id: string) {
    return this.whatsapp.getMessages(orgId, id)
  }

  @Get('conversations/:id/context')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async getConversationContext(@Org() orgId: string, @Param('id') id: string) {
    return this.whatsapp.getContext(orgId, id)
  }

  @Post('conversations/:id/messages')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async sendConversationMessage(
    @Org() orgId: string,
    @User() user: any,
    @Param('id') conversationId: string,
    @Body() body: any,
  ) {
    const userId = user?.userId ?? user?.sub ?? null
    return this.whatsapp.sendManualMessage(orgId, userId, { ...body, conversationId })
  }

  @Post('messages/template')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async sendTemplate(
    @Org() orgId: string,
    @User() user: any,
    @Body() body: any,
  ) {
    if (!body?.conversationId && !body?.customerId) {
      throw new BadRequestException('conversationId ou customerId é obrigatório')
    }
    const userId = user?.userId ?? user?.sub ?? null
    return this.whatsapp.sendTemplateMessage(orgId, userId, body)
  }

  @Post('messages/:id/retry')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async retry(@Org() orgId: string, @Param('id') id: string) {
    return this.whatsapp.retryFailedMessage(orgId, id)
  }

  @Patch('conversations/:id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async updateConversationStatus(
    @Org() orgId: string,
    @Param('id') id: string,
    @Body('status') status: WhatsAppConversationStatus,
  ) {
    if (!status) throw new BadRequestException('status é obrigatório')
    return this.whatsapp.updateConversationStatus(orgId, id, status)
  }

  @Post('webhook/:provider')
  async webhook(@Param('provider') provider: string, @Body() payload: any) {
    const serviceProvider = createWhatsAppProvider()
    const webhookEvent = await this.whatsapp.createWebhookEvent({
      provider,
      eventType: String(payload?.eventType ?? 'unknown'),
      payload,
    })

    try {
      const result = await this.whatsapp.processInboundWebhook(provider, payload)
      await this.whatsapp.completeWebhookEvent(webhookEvent.id, {
        status: 'PROCESSED',
        orgId: result.results?.find((r: any) => r.orgId)?.orgId ?? null,
      })
      return { ok: true, provider: serviceProvider.getProviderName(), received: true }
    } catch (error: any) {
      await this.whatsapp.completeWebhookEvent(webhookEvent.id, {
        status: 'FAILED',
        errorMessage: String(error?.message ?? 'parse_failed'),
      })
      return { ok: true, received: true }
    }
  }

  @Get('health')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async health() {
    const readiness = getWhatsAppProviderReadiness(process.env)
    const provider = createWhatsAppProvider()
    return {
      provider: provider.getProviderName(),
      status: readiness.mode === 'mock' ? 'configured_mock' : readiness.isReady ? 'configured' : 'misconfigured',
      missingEnv: readiness.missingEnv,
      queueAvailable: true,
    }
  }

  // Backward compatibility
  @Get('messages/:customerId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async getMessagesByCustomer(
    @Org() orgId: string,
    @Param('customerId') customerId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = Number(limit)
    return this.whatsapp.getMessagesFeed({
      orgId,
      customerId,
      cursor: cursor ? String(cursor) : undefined,
      limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined,
    })
  }

  @Post('messages')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async sendMessage(
    @Org() orgId: string,
    @User() user: any,
    @Headers('idempotency-key') idempotencyKeyHeader: string | undefined,
    @Body() body: any,
  ) {
    await this.quotas.validateQuota(orgId, 'SEND_MESSAGE')

    const payload = {
      customerId: body.customerId,
      toPhone: body.toPhone,
      entityType: body.entityType ?? 'CUSTOMER',
      entityId: body.entityId ?? body.customerId,
      messageType: body.messageType ?? 'MANUAL',
      content: body.content,
    }

    const idempotencyKey =
      String(body?.idempotencyKey ?? idempotencyKeyHeader ?? '').trim()
      || buildDeterministicMessageKey({
        entityType: payload.entityType,
        entityId: String(payload.entityId),
        messageType: payload.messageType,
      })

    const idem = await this.idempotency.begin({
      orgId,
      scope: 'whatsapp.send_message',
      idempotencyKey,
      payload,
    })

    if (idem.mode === 'replay') {
      return idem.response
    }

    try {
      const userId = user?.userId ?? user?.sub ?? null
      const result = await this.whatsapp.sendManualMessage(orgId, userId, payload)
      await this.idempotency.complete(idem.recordId, result)
      return result
    } catch (error: any) {
      await this.idempotency.fail(idem.recordId, error?.code)
      throw error
    }
  }

  @Patch('messages/:id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async updateStatus(
    @Org() orgId: string,
    @Param('id') id: string,
    @Body('status') status: WhatsAppMessageStatus,
  ) {
    return this.whatsapp.updateMessageStatus(orgId, { id, status })
  }
}
