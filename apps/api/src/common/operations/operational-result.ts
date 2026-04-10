export type OperationalExecutionStatus =
  | 'executed'
  | 'queued'
  | 'skipped'
  | 'blocked'
  | 'duplicate'
  | 'retry_scheduled'
  | 'failed'
  | 'degraded'

export type OperationalResultEnvelope = {
  operation: {
    status: OperationalExecutionStatus
    reason: string | null
    idempotencyKey: string | null
    executionKey: string | null
    correlationId: string | null
    requestId: string | null
  }
}

export function buildOperationalResult(params: {
  status: OperationalExecutionStatus
  reason?: string | null
  idempotencyKey?: string | null
  executionKey?: string | null
  correlationId?: string | null
  requestId?: string | null
}): OperationalResultEnvelope['operation'] {
  return {
    status: params.status,
    reason: params.reason ?? null,
    idempotencyKey: params.idempotencyKey ?? null,
    executionKey: params.executionKey ?? null,
    correlationId: params.correlationId ?? null,
    requestId: params.requestId ?? null,
  }
}
