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
}
