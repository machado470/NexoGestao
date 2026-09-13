import { context, metrics, propagation, SpanStatusCode, trace } from '@opentelemetry/api'
import { createRequire } from 'node:module'
import { MetricsService } from './common/metrics/metrics.service'
import { QueueService } from './queue/queue.service'

// These SDK packages are already supplied by @opentelemetry/sdk-node. Resolving
// from that package keeps this proof on the exact SDK version used in production.
const sdkRequire = createRequire(require.resolve('@opentelemetry/sdk-node'))
const { W3CTraceContextPropagator } = sdkRequire('@opentelemetry/core')
const { NodeTracerProvider } = sdkRequire('@opentelemetry/sdk-trace-node')
const { InMemorySpanExporter, SimpleSpanProcessor } = sdkRequire('@opentelemetry/sdk-trace-base')
const {
  AggregationTemporality,
  InMemoryMetricExporter,
  MeterProvider,
  PeriodicExportingMetricReader,
} = sdkRequire('@opentelemetry/sdk-metrics')

describe('real OpenTelemetry SDK proofs', () => {
  afterEach(() => {
    context.disable()
    propagation.disable()
    trace.disable()
    metrics.disable()
  })

  it('continues an extracted W3C trace and exports the failed worker span', async () => {
    const exporter = new InMemorySpanExporter()
    const provider = new NodeTracerProvider()
    provider.addSpanProcessor(new SimpleSpanProcessor(exporter))
    provider.register({ propagator: new W3CTraceContextPropagator() })
    const parentTraceId = '11111111111111111111111111111111'
    const parentSpanId = '2222222222222222'
    const failure = new Error('worker failed')
    const service = new QueueService(
      { status: 'ready' } as any,
      {} as any,
      { increment: jest.fn() } as any,
      {} as any,
    )

    await expect(service.processJobWithTracing(
      'finance',
      'create-charge',
      { meta: { traceContext: { traceparent: `00-${parentTraceId}-${parentSpanId}-01` } } },
      async () => { throw failure },
    )).rejects.toThrow(failure)

    await provider.forceFlush()
    const [workerSpan] = exporter.getFinishedSpans()
    expect(workerSpan.spanContext().traceId).toBe(parentTraceId)
    expect(workerSpan.spanContext().spanId).not.toBe(parentSpanId)
    expect(workerSpan.status).toEqual({ code: SpanStatusCode.ERROR, message: failure.message })
    expect(workerSpan.ended).toBe(true)
    await provider.shutdown()
  })

  it('collects a custom metric with only the controlled labels', async () => {
    const exporter = new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE)
    const reader = new PeriodicExportingMetricReader({ exporter, exportIntervalMillis: 60_000 })
    const provider = new MeterProvider({ readers: [reader] })
    metrics.setGlobalMeterProvider(provider)

    new MetricsService().increment('executionActionStatus:failed')
    await reader.forceFlush()

    const points = exporter.getMetrics()
      .flatMap((resource: any) => resource.scopeMetrics)
      .flatMap((scope: any) => scope.metrics)
    const domainMetric = points.find((metric: any) => metric.descriptor.name === 'nexo_domain_operations_total')
    expect(domainMetric).toBeDefined()
    expect(domainMetric.dataPoints).toHaveLength(1)
    expect(domainMetric.dataPoints[0].attributes).toEqual({ operation: 'execution_action', status: 'failed' })
    expect(domainMetric.dataPoints[0].attributes).not.toEqual(expect.objectContaining({
      orgId: expect.anything(), userId: expect.anything(), requestId: expect.anything(),
      correlationId: expect.anything(), traceId: expect.anything(),
    }))
    await provider.shutdown()
  })
})
