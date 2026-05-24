import { resolveRequestTracing, sanitizeTracingId } from './request-tracing.util'

describe('request-tracing util', () => {
  it('gera requestId quando header ausente', () => {
    const tracing = resolveRequestTracing({})
    expect(typeof tracing.requestId).toBe('string')
    expect(tracing.requestId.length).toBeGreaterThan(0)
    expect(tracing.correlationId).toBe(tracing.requestId)
  })

  it('preserva x-request-id saneado e correlation externo', () => {
    const tracing = resolveRequestTracing({ 'x-request-id': 'req-abc.123', 'x-correlation-id': 'corr-xyz' })
    expect(tracing.requestId).toBe('req-abc.123')
    expect(tracing.correlationId).toBe('corr-xyz')
  })

  it('descarta ids inválidos', () => {
    expect(sanitizeTracingId('  ')).toBeNull()
    expect(sanitizeTracingId('id\n2')).toBeNull()
  })
})
