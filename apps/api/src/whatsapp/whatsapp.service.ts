import { Injectable, Logger } from '@nestjs/common'
import {
  WhatsAppEntityType,
  WhatsAppMessageStatus,
  WhatsAppMessageType,
} from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { QueueService } from '../queue/queue.service'
import { QUEUE_NAMES } from '../queue/queue.constants'
import { TimelineService } from '../timeline/timeline.service'
import { RequestContextService } from '../common/context/request-context.service'

type QueueMessageInput = {
  orgId: string
  customerId: string
  toPhone: string
  entityType: WhatsAppEntityType
  entityId: string
  messageType: WhatsAppMessageType
  messageKey: string
  renderedText: string
}

export function buildDeterministicMessageKey(input: {
  entityType: WhatsAppEntityType
  entityId: string
  messageType: WhatsAppMessageType
}): string {
  return `${input.entityType}:${input.entityId}:${input.messageType}`
}

function isPrismaP1017(err: any): boolean {
  return (
    err?.code === 'P1017' ||
    String(err?.message ?? '').includes('closed the connection')
  )
}

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
    private readonly timeline: TimelineService,
    private readonly requestContext: RequestContextService,
  ) {}

  private logStructured(params: {
    level: 'log' | 'warn' | 'error'
    action: string
    entityId?: string | null
    message: string
    extra?: Record<string, unknown>
  }) {
    const line = JSON.stringify({
      requestId: this.requestContext.requestId,
      action: params.action,
      entityId: params.entityId ?? null,
      message: params.message,
      ...params.extra,
    })

    if (params.level === 'error') {
      this.logger.error(line)
      return
    }
    if (params.level === 'warn') {
      this.logger.warn(line)
      return
    }
    this.logger.log(line)
  }

  async enqueueMessage(input: QueueMessageInput) {
    const result = await this.queueMessage(input)
    const message = result.message
    if (!message) return result

    await this.queueService.addJob(QUEUE_NAMES.WHATSAPP, 'dispatch-message', {
      messageId: message.id,
    }, {
      jobId: `whatsapp:dispatch:${message.id}`,
    })

    return result
  }

  async findById(id: string) {
    return this.prisma.whatsAppMessage.findUnique({ where: { id } })
  }

  private async reconnectIfNeeded(err: any) {
    if (!isPrismaP1017(err)) return false

    this.logger.warn('[P1017] DB connection closed. Reconnecting Prisma...')

    try {
      await this.prisma.$disconnect()
    } catch {}

    try {
      await this.prisma.$connect()
      this.logger.warn('[P1017] Prisma reconnected.')
      return true
    } catch (e: any) {
      this.logger.error(
        `[P1017] Prisma reconnect failed: ${e?.message ?? e}`,
      )
      return false
    }
  }

  async queueMessage(input: QueueMessageInput) {
    const {
      orgId,
      customerId,
      toPhone,
      entityType,
      entityId,
      messageType,
      messageKey,
      renderedText,
    } = input

    try {
      const created = await this.prisma.whatsAppMessage.create({
        data: {
          orgId,
          customerId,
          toPhone,
          entityType,
          entityId,
          messageType,
          messageKey,
          renderedText,
          status: WhatsAppMessageStatus.QUEUED,
        },
      })

      this.logStructured({
        level: 'log',
        action: 'WHATSAPP_MESSAGE_QUEUED',
        entityId: created.id,
        message: 'Mensagem WhatsApp enfileirada',
        extra: {
          messageKey,
          messageType,
          toPhone,
        },
      })

      return { created: true, message: created }
    } catch (err: any) {
      if (err?.code === 'P2002') {
        const existing = await this.prisma.whatsAppMessage.findUnique({
          where: { messageKey },
        })
        return { created: false, message: existing }
      }

      throw err
    }
  }

  async claimQueued(params: { limit?: number; workerId: string }) {
    const limit = params.limit ?? 50
    const workerId = params.workerId

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const claimedIds = await this.prisma.$transaction(async (tx) => {
          const rows = await tx.$queryRawUnsafe<Array<{ id: string }>>(
            `
            WITH picked AS (
              SELECT id
              FROM "WhatsAppMessage"
              WHERE status = 'QUEUED'
              ORDER BY "createdAt" ASC
              FOR UPDATE SKIP LOCKED
              LIMIT $1
            )
            UPDATE "WhatsAppMessage" m
            SET status = 'SENDING'
            FROM picked
            WHERE m.id = picked.id
            RETURNING m.id;
            `,
            limit,
          )

          return rows.map((r) => r.id)
        })

        if (claimedIds.length === 0) return []

        const claimed = await this.prisma.whatsAppMessage.findMany({
          where: { id: { in: claimedIds } },
          orderBy: { createdAt: 'asc' },
        })

        this.logger.log(
          `claimed ${claimed.length} whatsapp message(s) worker=${workerId}`,
        )

        return claimed
      } catch (err: any) {
        const reconnected = await this.reconnectIfNeeded(err)

        if (reconnected && attempt === 1) {
          this.logger.warn(
            `[claimQueued] retry after reconnect worker=${workerId}`,
          )
          continue
        }

        throw err
      }
    }

    return []
  }

  async findQueued(limit = 50) {
    return this.prisma.whatsAppMessage.findMany({
      where: { status: WhatsAppMessageStatus.QUEUED },
      orderBy: { createdAt: 'asc' },
      take: limit,
    })
  }

  async markSent(params: {
    id: string
    provider: string
    providerMessageId: string
  }) {
    const { id, provider, providerMessageId } = params

    this.logger.log(
      `whatsapp sent id=${id} provider=${provider} providerMessageId=${providerMessageId}`,
    )

    const updated = await this.prisma.whatsAppMessage.update({
      where: { id },
      data: {
        status: WhatsAppMessageStatus.SENT,
        provider,
        providerMessageId,
        errorCode: null,
        errorMessage: null,
      },
    })

    await this.timeline
      .log({
        orgId: updated.orgId,
        action: 'WHATSAPP_MESSAGE_SENT',
        description: `Mensagem WhatsApp enviada (${updated.messageType})`,
        customerId: updated.customerId,
        serviceOrderId:
          updated.entityType === WhatsAppEntityType.SERVICE_ORDER
            ? updated.entityId
            : null,
        appointmentId:
          updated.entityType === WhatsAppEntityType.APPOINTMENT
            ? updated.entityId
            : null,
        chargeId:
          updated.entityType === WhatsAppEntityType.CHARGE ? updated.entityId : null,
        metadata: {
          messageId: updated.id,
          entityId: updated.entityId,
          entityType: updated.entityType,
          messageType: updated.messageType,
          provider,
          providerMessageId,
        },
      })
      .catch((error) => {
        this.logStructured({
          level: 'error',
          action: 'WHATSAPP_TIMELINE_LOG_FAILED',
          entityId: updated.id,
          message: 'Falha ao registrar envio de WhatsApp na timeline',
          extra: { error: error instanceof Error ? error.message : String(error) },
        })
      })

    return updated
  }

  async markFailedAndRequeue(params: {
    id: string
    provider: string
    errorCode: string
    errorMessage: string
  }) {
    const { id, provider, errorCode, errorMessage } = params

    this.logStructured({
      level: 'warn',
      action: 'WHATSAPP_SEND_FAILED_REQUEUED',
      entityId: id,
      message: 'Falha de envio WhatsApp. Mensagem voltou para fila (modo degradado)',
      extra: { provider, errorCode, errorMessage },
    })

    return this.prisma.whatsAppMessage.update({
      where: { id },
      data: {
        status: WhatsAppMessageStatus.QUEUED,
        provider,
        errorCode,
        errorMessage,
      },
    })
  }
}
