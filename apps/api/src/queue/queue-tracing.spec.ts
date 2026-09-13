const injectedCarrier = { traceparent: '00-11111111111111111111111111111111-2222222222222222-01' }
const extractedParent = { parent: true }
const span = { end: jest.fn(), recordException: jest.fn(), setStatus: jest.fn() }
const startActiveSpan = jest.fn((_name, _options, _parent, callback) => callback(span))

jest.mock('@opentelemetry/api', () => ({
  context: { active: jest.fn(() => ({})) },
  propagation: {
    inject: jest.fn((_ctx, carrier) => Object.assign(carrier, injectedCarrier, { baggage: 'must-not-cross' })),
    extract: jest.fn((_ctx, carrier) => Object.keys(carrier).length ? extractedParent : {}),
  },
  SpanStatusCode: { ERROR: 2 },
  trace: { getTracer: () => ({ startActiveSpan }) },
}))

import { propagation } from '@opentelemetry/api'
import { QueueService } from './queue.service'

describe('QueueService W3C asynchronous context', () => {
  const createService = () => new QueueService(
    { status: 'ready' } as any, {} as any,
    { increment: jest.fn(), setGauge: jest.fn(), observeDuration: jest.fn() } as any,
    { requestId: 'req-1', correlationId: 'corr-1' } as any,
  ) as any

  beforeEach(() => jest.clearAllMocks())

  it('injects only trace context and preserves durable operational ids', () => {
    const payload = createService().withRequestTracing({ orgId: 'authoritative-org' })
    expect(payload.meta).toMatchObject({ requestId: 'req-1', correlationId: 'corr-1', traceContext: injectedCarrier })
    expect(payload.meta.traceContext).not.toHaveProperty('baggage')
    expect(payload.orgId).toBe('authoritative-org')
  })

  it('extracts the parent, closes the child span, and never uses context as tenant authority', async () => {
    const service = createService()
    const payload = { orgId: 'authoritative-org', meta: { traceContext: { ...injectedCarrier, orgId: 'spoofed' } } }
    await expect(service.processJobWithTracing('whatsapp', 'inbound-webhook', payload, async () => payload.orgId)).resolves.toBe('authoritative-org')
    expect(propagation.extract).toHaveBeenCalledWith(expect.anything(), injectedCarrier)
    expect(startActiveSpan).toHaveBeenCalledWith('queue.process', expect.anything(), extractedParent, expect.any(Function))
    expect(span.end).toHaveBeenCalledTimes(1)
  })

  it('records errors and ends spans even when processing throws', async () => {
    const failure = new Error('sanitized failure')
    await expect(createService().processJobWithTracing('finance', 'create-charge', {}, async () => { throw failure })).rejects.toThrow(failure)
    expect(span.recordException).toHaveBeenCalledWith(failure)
    expect(span.setStatus).toHaveBeenCalledWith({ code: 2, message: failure.message })
    expect(span.end).toHaveBeenCalledTimes(1)
  })

  it('does not invent or attach trace metadata when no active context is injected', () => {
    ;(propagation.inject as jest.Mock).mockImplementationOnce(() => undefined)
    const payload = createService().withRequestTracing({
      orgId: 'org-1',
      meta: {
        requestId: 'request-from-job',
        correlationId: 'correlation-from-job',
        traceContext: { traceparent: 'forged-parent', baggage: 'forged-baggage' },
      },
    })
    expect(payload.meta).not.toHaveProperty('traceContext')
    expect(payload.meta).toMatchObject({ requestId: 'request-from-job', correlationId: 'correlation-from-job' })
    expect(payload.orgId).toBe('org-1')
    expect(payload).not.toHaveProperty('traceId')
  })

  it('replaces received trace metadata exclusively with the context injected now', () => {
    const payload = createService().withRequestTracing({
      orgId: 'authoritative-org',
      meta: {
        requestId: 'request-from-job',
        correlationId: 'correlation-from-job',
        traceContext: {
          traceparent: 'forged-parent',
          tracestate: 'forged=state',
          baggage: 'tenant=spoofed',
          orgId: 'spoofed-org',
          extra: 'must-not-cross',
        },
      },
    })

    expect(payload.meta.traceContext).toEqual(injectedCarrier)
    expect(payload.meta.traceContext.traceparent).not.toBe('forged-parent')
    expect(payload.meta).toMatchObject({ requestId: 'request-from-job', correlationId: 'correlation-from-job' })
    expect(payload.orgId).toBe('authoritative-org')
  })
})
