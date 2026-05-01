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
  Logger,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
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
import { ListConversationsQueryDto, MessageFeedQueryDto, SendConversationMessageDto, SendMessageDto, SendTemplateMessageDto, UpdateConversationStatusDto, UpdateMessageStatusDto } from './dto/whatsapp.dto'

@ApiTags('WhatsApp')
@ApiBearerAuth()
@Controller('whatsapp')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class WhatsAppController {
  private readonly logger = new Logger(WhatsAppController.name)
  constructor(
    private readonly whatsapp: WhatsAppService,
    private readonly quotas: QuotasService,
    private readonly idempotency: IdempotencyService,
  ) {}

  @Get('conversations')
  @ApiOperation({ summary: 'List WhatsApp conversations' })
  async listConversations(@Org() orgId: string, @Query() query: ListConversationsQueryDto) {
    return this.whatsapp.listConversations(orgId, query)
  }
  @Get('inbox')
  async listInbox(@Org() orgId: string, @Query() query: ListConversationsQueryDto) { return this.whatsapp.listConversations(orgId, query) }

  @Get('conversations/:id')
  async getConversation(@Org() orgId: string, @Param('id') id: string) {
    return this.whatsapp.getConversation(orgId, id)
  }

  @Get('conversations/:id/messages')
  async getConversationMessages(@Org() orgId: string, @Param('id') id: string) {
    return this.whatsapp.getMessages(orgId, id)
  }

  @Get('conversations/:id/context')
  async getConversationContext(@Org() orgId: string, @Param('id') id: string) {
    return this.whatsapp.getContext(orgId, id)
  }

  @Post('conversations/:id/messages')
  async sendConversationMessage(
    @Org() orgId: string,
    @User() user: any,
    @Param('id') conversationId: string,
    @Body() body: SendConversationMessageDto,
  ) {
    const userId = user?.userId ?? user?.sub ?? null
    this.logger.log(`outbound_message conversation=${conversationId} org=${orgId} user=${userId}`)
    return this.whatsapp.sendManualMessage(orgId, userId, { ...body, conversationId })
  }

  @Post('messages/template')
  async sendTemplate(
    @Org() orgId: string,
    @User() user: any,
    @Body() body: SendTemplateMessageDto,
  ) {
    if (!body?.conversationId && !body?.customerId) {
      throw new BadRequestException('conversationId ou customerId é obrigatório')
    }
    const userId = user?.userId ?? user?.sub ?? null
    return this.whatsapp.sendTemplateMessage(orgId, userId, body)
  }

  @Post('messages/:id/retry')
  async retry(@Org() orgId: string, @Param('id') id: string) {
    return this.whatsapp.retryFailedMessage(orgId, id)
  }

  @Patch('conversations/:id/status')
  async updateConversationStatus(
    @Org() orgId: string,
    @Param('id') id: string,
    @Body() body: UpdateConversationStatusDto,
  ) {
    return this.whatsapp.updateConversationStatus(orgId, id, body.status)
  }
  @Post('conversations/:id/resolve')
  async markResolved(@Org() orgId: string, @Param('id') id: string) { this.logger.log(`resolve_conversation id=${id} org=${orgId}`); return this.whatsapp.updateConversationStatus(orgId, id, WhatsAppConversationStatus.RESOLVED) }

  @Post('conversations/:id/reopen')
  async reopenConversation(@Org() orgId: string, @Param('id') id: string) { return this.whatsapp.updateConversationStatus(orgId, id, WhatsAppConversationStatus.WAITING_OPERATOR) }

  @Post('webhooks/:provider')
  @ApiBearerAuth()
  async webhook(@Param('provider') provider: string, @Body() payload: any, @Headers() headers: Record<string, string>) {
    const serviceProvider = createWhatsAppProvider()
    if (serviceProvider.getProviderName() !== provider) throw new BadRequestException('provider inválido')
    const signatureOk = await serviceProvider.verifyWebhookSignature(payload, headers)
    if (!signatureOk) throw new BadRequestException('assinatura inválida')
    const webhookEvent = await this.whatsapp.createWebhookEvent({
      provider,
      eventType: String(payload?.eventType ?? 'unknown'),
      payload,
    })

    try {
      this.logger.log(`inbound_webhook provider=${provider}`)
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
  @Post('webhook/:provider')
  async webhookLegacy(@Param('provider') provider: string, @Body() payload: any, @Headers() headers: Record<string, string>) {
    return this.webhook(provider, payload, headers)
  }

  @Get('health')
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
  async getMessagesByCustomer(
    @Org() orgId: string,
    @Param('customerId') customerId: string,
    @Query() query: MessageFeedQueryDto,
  ) {
    return this.whatsapp.getMessagesFeed({
      orgId,
      customerId,
      cursor: query.cursor ? String(query.cursor) : undefined,
      limit: query.limit,
    })
  }

  @Post('messages')
  async sendMessage(
    @Org() orgId: string,
    @User() user: any,
    @Headers('idempotency-key') idempotencyKeyHeader: string | undefined,
    @Body() body: SendMessageDto,
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
  async updateStatus(
    @Org() orgId: string,
    @Param('id') id: string,
    @Body() body: UpdateMessageStatusDto,
  ) {
    return this.whatsapp.updateMessageStatus(orgId, { id, status: body.status })
  }
}
