import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { createHash } from 'crypto'
import { RequestContextService } from '../context/request-context.service'
import { MetricsService } from '../metrics/metrics.service'

type BeginInput = {
  orgId: string
  scope: string
  idempotencyKey: string
  payload: unknown
}

type BeginResult =
  | { mode: 'execute'; recordId: string }
  | { mode: 'replay'; response: unknown; recordId: string }

@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name)
  private get idemModel() {
    return (this.prisma as any).idempotencyRecord
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
    private readonly metrics: MetricsService,
  ) {}

  buildPayloadHash(payload: unknown): string {
    return createHash('sha256').update(this.stableStringify(payload)).digest('hex')
  }

  private stableStringify(value: unknown): string {
    if (value === null || value === undefined) return 'null'
    if (typeof value !== 'object') return JSON.stringify(value)
    if (Array.isArray(value)) {
      return `[${value.map((item) => this.stableStringify(item)).join(',')}]`
    }

    const entries = Object.entries(value as Record<string, unknown>).sort((a, b) =>
      a[0].localeCompare(b[0]),
    )
    return `{${entries
      .map(([k, v]) => `${JSON.stringify(k)}:${this.stableStringify(v)}`)
      .join(',')}}`
  }

  async begin(input: BeginInput): Promise<BeginResult> {
    const payloadHash = this.buildPayloadHash(input.payload)

    try {
      const created = await this.idemModel.create({
        data: {
          orgId: input.orgId,
          scope: input.scope,
          key: input.idempotencyKey,
          payloadHash,
          status: 'PROCESSING',
        },
      })
      return { mode: 'execute', recordId: created.id }
    } catch (error: any) {
      if (error?.code !== 'P2002') throw error

      const existing = await this.idemModel.findFirst({
        where: {
          orgId: input.orgId,
          scope: input.scope,
          key: input.idempotencyKey,
        },
      })

      if (!existing) throw error

      if (existing.payloadHash !== payloadHash) {
        this.logger.warn(
          JSON.stringify({
            requestId: this.requestContext.requestId,
            action: 'IDEMPOTENCY_CONFLICT',
            orgId: input.orgId,
            scope: input.scope,
            key: input.idempotencyKey,
          }),
        )
        this.metrics.increment('idempotencyConflicts')
        throw new BadRequestException({
          code: 'IDEMPOTENCY_KEY_CONFLICT',
          message:
            'A chave de idempotência já foi usada com payload diferente.',
          details: {
            scope: input.scope,
            idempotencyKey: input.idempotencyKey,
          },
        })
      }

      if (existing.status === 'COMPLETED' && existing.response != null) {
        this.logger.log(
          JSON.stringify({
            requestId: this.requestContext.requestId,
            action: 'IDEMPOTENCY_REPLAY',
            orgId: input.orgId,
            scope: input.scope,
            key: input.idempotencyKey,
          }),
        )
        this.metrics.increment('idempotencyReplays')
        return { mode: 'replay', response: existing.response, recordId: existing.id }
      }

      if (existing.status === 'FAILED') {
        await this.idemModel.update({
          where: { id: existing.id },
          data: { status: 'PROCESSING', response: null, errorCode: null },
        })
        return { mode: 'execute', recordId: existing.id }
      }

      this.metrics.increment('idempotencyInProgress')
      throw new ConflictException({
        code: 'IDEMPOTENCY_IN_PROGRESS',
        message: 'Operação idempotente ainda em processamento.',
        details: {
          scope: input.scope,
          idempotencyKey: input.idempotencyKey,
        },
      })
    }
  }

  async complete(recordId: string, response: unknown) {
    await this.idemModel.update({
      where: { id: recordId },
      data: {
        status: 'COMPLETED',
        response: response as any,
      },
    })
  }

  async fail(recordId: string, errorCode?: string) {
    await this.idemModel.update({
      where: { id: recordId },
      data: {
        status: 'FAILED',
        errorCode: errorCode ?? 'FAILED',
      },
    })
  }
}
