import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { TimelineService } from '../timeline/timeline.service'
import type {
  ExecutionEventPayload,
  ExecutionRunnerStatus,
  ExecutionStateSummary,
} from './execution.types'

const EXECUTION_EVENT_ACTION = 'EXECUTION_EVENT'

@Injectable()
export class ExecutionEventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly timeline: TimelineService,
  ) {}

  async recordEvent(orgId: string, payload: ExecutionEventPayload) {
    await this.timeline.log({
      orgId,
      action: EXECUTION_EVENT_ACTION,
      description: `${payload.actionId} => ${payload.status}`,
      customerId: payload.customerId,
      metadata: payload,
    })
  }

  async hasRecentExecution(params: {
    orgId: string
    executionKey: string
    withinMs: number
  }) {
    const since = new Date(Date.now() - params.withinMs)

    const recent = await this.prisma.timelineEvent.findFirst({
      where: {
        orgId: params.orgId,
        action: EXECUTION_EVENT_ACTION,
        createdAt: { gte: since },
        metadata: {
          path: ['executionKey'],
          equals: params.executionKey,
        },
        OR: [
          { metadata: { path: ['status'], equals: 'executed' as ExecutionRunnerStatus } },
          { metadata: { path: ['eventType'], equals: 'EXECUTION_ACTION_REQUESTED' } },
        ],
      },
      select: { id: true },
    })

    return Boolean(recent?.id)
  }

  async countRecentFailures(params: {
    orgId: string
    executionKey: string
    withinMs: number
  }) {
    const since = new Date(Date.now() - params.withinMs)

    return this.prisma.timelineEvent.count({
      where: {
        orgId: params.orgId,
        action: EXECUTION_EVENT_ACTION,
        createdAt: { gte: since },
        metadata: {
          path: ['executionKey'],
          equals: params.executionKey,
        },
        OR: [
          { metadata: { path: ['status'], equals: 'failed' as ExecutionRunnerStatus } },
          { metadata: { path: ['status'], equals: 'throttled' as ExecutionRunnerStatus } },
        ],
      },
    })
  }

  async getStateSummary(orgId: string, sinceMs = 1000 * 60 * 60 * 24): Promise<ExecutionStateSummary> {
    const since = new Date(Date.now() - sinceMs)

    const rows = await this.prisma.timelineEvent.findMany({
      where: {
        orgId,
        action: EXECUTION_EVENT_ACTION,
        createdAt: { gte: since },
      },
      select: { metadata: true },
      orderBy: { createdAt: 'desc' },
      take: 2000,
    })

    const summary: ExecutionStateSummary = {
      pending: 0,
      executed: 0,
      failed: 0,
      blocked: 0,
      throttled: 0,
    }

    for (const row of rows) {
      const metadata = (row.metadata ?? {}) as Record<string, unknown>
      const status = String(metadata.status ?? '').trim()

      if (status === 'executed') summary.executed += 1
      else if (status === 'failed') summary.failed += 1
      else if (status === 'blocked' || status === 'requires_confirmation') summary.blocked += 1
      else if (status === 'throttled') summary.throttled += 1
      else summary.pending += 1
    }

    return summary
  }

  async listRecentEvents(
    orgId: string,
    limit = 100,
    filters?: { status?: string; actionId?: string; entityType?: string },
  ) {
    const normalizedLimit = Math.max(1, Math.min(500, Number(limit) || 100))
    const normalizedStatus = typeof filters?.status === 'string' && filters.status.trim() ? filters.status.trim() : null
    const normalizedActionId =
      typeof filters?.actionId === 'string' && filters.actionId.trim() ? filters.actionId.trim() : null
    const normalizedEntityType =
      typeof filters?.entityType === 'string' && filters.entityType.trim() ? filters.entityType.trim() : null

    const rows = await this.prisma.timelineEvent.findMany({
      where: {
        orgId,
        action: EXECUTION_EVENT_ACTION,
      },
      select: {
        id: true,
        createdAt: true,
        metadata: true,
      },
      orderBy: { createdAt: 'desc' },
      take: Math.max(normalizedLimit * 4, 100),
    })

    return rows
      .map((row) => {
      const meta = (row.metadata ?? {}) as Record<string, unknown>
      return {
        id: row.id,
        actionId: String(meta.actionId ?? ''),
        decisionId: String(meta.decisionId ?? ''),
        entityType: String(meta.entityType ?? ''),
        entityId: String(meta.entityId ?? ''),
        eventType: String(meta.eventType ?? ''),
        status: String(meta.status ?? ''),
        reasonCode: typeof meta.reasonCode === 'string' ? meta.reasonCode : null,
        mode: typeof meta.mode === 'string' ? meta.mode : null,
        timestamp:
          typeof meta.timestamp === 'string' && meta.timestamp
            ? meta.timestamp
            : row.createdAt.toISOString(),
        metadata: typeof meta.metadata === 'object' && meta.metadata ? meta.metadata : null,
        diagnostics: {
          executionKey: typeof meta.executionKey === 'string' ? meta.executionKey : null,
          policySignal: typeof meta.policySignal === 'string' ? meta.policySignal : null,
          governanceSignal: typeof meta.governanceSignal === 'string' ? meta.governanceSignal : null,
          explanation:
            typeof meta.explanation === 'object' && meta.explanation
              ? (meta.explanation as Record<string, unknown>)
              : null,
        },
      }
      })
      .filter((event) => {
        if (normalizedStatus && event.status !== normalizedStatus) return false
        if (normalizedActionId && event.actionId !== normalizedActionId) return false
        if (normalizedEntityType && event.entityType !== normalizedEntityType) return false
        return true
      })
      .slice(0, normalizedLimit)
  }
}
