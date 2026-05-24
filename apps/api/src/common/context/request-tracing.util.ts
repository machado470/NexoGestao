import { randomUUID } from 'crypto'

const MAX_ID_LENGTH = 128
const ALLOWED_ID_PATTERN = /^[A-Za-z0-9._:-]+$/

export function sanitizeTracingId(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > MAX_ID_LENGTH) return null
  if (!ALLOWED_ID_PATTERN.test(trimmed)) return null
  return trimmed
}

export function resolveRequestTracing(headers: Record<string, unknown>) {
  const requestId = sanitizeTracingId(headers['x-request-id']) ?? randomUUID()
  const correlationId = sanitizeTracingId(headers['x-correlation-id']) ?? requestId
  return { requestId, correlationId }
}

export type RequestTracingContext = {
  requestId: string
  correlationId: string
}
