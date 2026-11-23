import { HttpException, Logger } from '@nestjs/common'
import type { AuditService } from './audit.service'
import type { AuditAction } from './audit.actions'

/**
 * C8 PR3-3B-7 — audit trail of a manual administrative run.
 *
 * Exactly one audit event per authenticated attempt that reaches the controller (requests refused by
 * the guards never get here, so they run nothing and are not audited by this helper):
 * - the run resolves → one event with the outcome the caller derives from the result
 *   (e.g. SUCCEEDED, COMPLETED_WITH_FAILURES, SKIPPED_CYCLE_DELAY) and its counters;
 * - the run throws → one event with outcome FAILED, `partialEffectsPossible: true` (work done before
 *   the error is not rolled back) and only the error class/status — never its message, a token or a
 *   payload — and the original error is rethrown. A failed run is never recorded as a success.
 *
 * Identity comes only from the validated session (`req.user`): author user, author person and
 * organization. The correlation id is the request's, when present.
 */
export type ManualRunActor = { orgId: string; userId: string | null; personId: string | null }

export function manualRunActor(req: any): ManualRunActor {
  const user = req?.user ?? {}
  return {
    orgId: user.orgId,
    userId: user.userId ?? user.sub ?? null,
    personId: user.personId ?? null,
  }
}

export type ManualRunSummary = { outcome: string; counters?: Record<string, unknown> }

const logger = new Logger('ManualRunAudit')

export async function auditedManualRun<T>(params: {
  audit: Pick<AuditService, 'log'>
  action: AuditAction
  operation: string
  actor: ManualRunActor
  correlationId: string | null
  requested?: Record<string, unknown>
  run: () => Promise<T>
  summarize: (result: T) => ManualRunSummary
}): Promise<T> {
  const base = {
    orgId: params.actor.orgId,
    action: params.action,
    actorUserId: params.actor.userId,
    actorPersonId: params.actor.personId,
    entityType: 'Organization',
    entityId: params.actor.orgId,
  }
  const metadata = (extra: Record<string, unknown>) => ({
    operation: params.operation,
    scope: 'organization',
    correlationId: params.correlationId,
    ...(params.requested ? { requested: params.requested } : {}),
    ...extra,
  })

  let result: T
  try {
    result = await params.run()
  } catch (error) {
    try {
      await params.audit.log({
        ...base,
        context: `${params.operation}: falhou`,
        metadata: metadata({
          outcome: 'FAILED',
          partialEffectsPossible: true,
          error: {
            type: error instanceof Error ? error.constructor.name : typeof error,
            status: error instanceof HttpException ? error.getStatus() : null,
          },
        }),
      })
    } catch (auditError) {
      logger.error(
        JSON.stringify({ event: 'manual_run_failure_audit_failed', operation: params.operation, correlationId: params.correlationId }),
      )
    }
    throw error
  }

  const summary = params.summarize(result)
  await params.audit.log({
    ...base,
    context: `${params.operation}: ${summary.outcome}`,
    metadata: metadata({ outcome: summary.outcome, ...(summary.counters ? { counters: summary.counters } : {}) }),
  })
  return result
}
