import { Injectable, Logger } from '@nestjs/common'
import {
  WhatsAppEntityType,
  WhatsAppMessageStatus,
  WhatsAppMessageType,
} from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { QueueService } from '../queue/queue.service'
import { QUEUE_NAMES } from '../queue/queue.constants'

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
  ) {}

  async enqueueMessage(input: QueueMessageInput) {
    const result = await this.queueMessage(input)
    const message = result.message
    if (!message) return result

    await this.queueService.addJob(QUEUE_NAMES.WHATSAPP, 'dispatch-message', {
      messageId: message.id,
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

      this.logger.log(
        `queued whatsapp message key=${messageKey} to=${toPhone} type=${messageType}`,
      )

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

    return this.prisma.whatsAppMessage.update({
      where: { id },
      data: {
        status: WhatsAppMessageStatus.SENT,
        provider,
        providerMessageId,
        errorCode: null,
        errorMessage: null,
      },
    })
  }

  async markFailed(params: {
    id: string
    provider: string
    errorCode: string
    errorMessage: string
  }) {
    const { id, provider, errorCode, errorMessage } = params

    this.logger.warn(
      `whatsapp failed id=${id} provider=${provider} errorCode=${errorCode} errorMessage=${errorMessage}`,
    )

    return this.prisma.whatsAppMessage.update({
      where: { id },
      data: {
        status: WhatsAppMessageStatus.FAILED,
        provider,
        errorCode,
        errorMessage,
      },
    })
  }
}
