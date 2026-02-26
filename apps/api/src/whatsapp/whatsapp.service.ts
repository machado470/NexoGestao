// apps/api/src/whatsapp/whatsapp.service.ts

import { Injectable, Logger } from '@nestjs/common'
import {
  WhatsAppEntityType,
  WhatsAppMessageStatus,
  WhatsAppMessageType,
} from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'

type QueueMessageInput = {
  orgId: string
  customerId: string
  toPhone: string

  entityType: WhatsAppEntityType
  entityId: string
  messageType: WhatsAppMessageType

  messageKey: string

  templateKey?: string | null
  renderedText: string

  metadata?: any
}

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name)

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Enfileira mensagem (QUEUED) com idempotência real.
   */
  async queueMessage(input: QueueMessageInput) {
    const {
      orgId,
      customerId,
      toPhone,
      entityType,
      entityId,
      messageType,
      messageKey,
      templateKey,
      renderedText,
      metadata,
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
          templateKey: templateKey ?? null,
          renderedText,
          status: WhatsAppMessageStatus.QUEUED,
          metadata: metadata ?? undefined,
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

  /**
   * Claim concorrente seguro.
   * NÃO usa RETURNING m.* para evitar erro:
   * "cached plan must not change result type"
   */
  async claimQueued(params: { limit?: number; workerId: string }) {
    const limit = params.limit ?? 50
    const workerId = params.workerId

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
        SET
          status = 'SENDING',
          "lockedAt" = NOW(),
          "lockedBy" = $2
        FROM picked
        WHERE m.id = picked.id
        RETURNING m.id;
        `,
        limit,
        workerId,
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

    return this.prisma.whatsAppMessage.update({
      where: { id },
      data: {
        status: WhatsAppMessageStatus.SENT,
        provider,
        providerMessageId,
        sentAt: new Date(),
        errorCode: null,
        errorMessage: null,
        lockedAt: null,
        lockedBy: null,
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

    return this.prisma.whatsAppMessage.update({
      where: { id },
      data: {
        status: WhatsAppMessageStatus.FAILED,
        provider,
        errorCode,
        errorMessage,
        lockedAt: null,
        lockedBy: null,
      },
    })
  }
}
