type MaybeString = string | null | undefined

export type OperationalLogContextInput = {
  event: string
  orgId?: MaybeString
  requestId?: MaybeString
  correlationId?: MaybeString
  jobId?: MaybeString
  entityType?: MaybeString
  entityId?: MaybeString
  actionId?: MaybeString
  deliveryId?: MaybeString
  webhookId?: MaybeString
  attempt?: number | null
  errorCode?: MaybeString
  errorMessage?: MaybeString
  error?: unknown
}

export function serializeOperationalError(error: unknown): { name: string; message: string; code?: string } | null {
  if (!error) return null
  if (error instanceof Error) {
    const code = typeof (error as any).code === 'string' ? (error as any).code : undefined
    return { name: error.name, message: error.message, ...(code ? { code } : {}) }
  }
  if (typeof error === 'object') {
    const anyError = error as any
    const name = typeof anyError.name === 'string' ? anyError.name : 'Error'
    const message = typeof anyError.message === 'string' ? anyError.message : String(error)
    const code = typeof anyError.code === 'string' ? anyError.code : undefined
    return { name, message, ...(code ? { code } : {}) }
  }
  return { name: 'Error', message: String(error) }
}

export function buildOperationalLogContext(input: OperationalLogContextInput): Record<string, unknown> {
  const serializedError = serializeOperationalError(input.error)
  return {
    event: input.event,
    orgId: input.orgId ?? null,
    requestId: input.requestId ?? null,
    correlationId: input.correlationId ?? null,
    jobId: input.jobId ?? null,
    entityType: input.entityType ?? null,
    entityId: input.entityId ?? null,
    actionId: input.actionId ?? null,
    deliveryId: input.deliveryId ?? null,
    webhookId: input.webhookId ?? null,
    attempt: input.attempt ?? null,
    errorCode: input.errorCode ?? serializedError?.code ?? null,
    errorMessage: input.errorMessage ?? serializedError?.message ?? null,
    ...(serializedError ? { error: serializedError } : {}),
  }
}
