import { NodeSDK } from '@opentelemetry/sdk-node'
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus'

let otelSdk: NodeSDK | null = null
let started = false

function isOtelEnabled() {
  return (process.env.OTEL_ENABLED ?? '').trim().toLowerCase() === 'true'
}

export async function startTracing() {
  if (!isOtelEnabled()) return false
  if (process.env.NODE_ENV === 'test') return false
  if (started) return true

  const prometheusExporter = new PrometheusExporter({
    port: Number(process.env.OTEL_METRICS_PORT || '9464'),
    endpoint: process.env.OTEL_METRICS_ENDPOINT || '/metrics',
  })

  otelSdk = new NodeSDK({
    serviceName: process.env.OTEL_SERVICE_NAME || 'nexogestao-api',
    metricReader: prometheusExporter,
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-http': { enabled: true },
        '@opentelemetry/instrumentation-ioredis': { enabled: true },
        '@opentelemetry/instrumentation-pg': { enabled: true },
        '@opentelemetry/instrumentation-mysql2': { enabled: true },
        '@opentelemetry/instrumentation-nestjs-core': { enabled: true },
      }),
    ],
  })

  await otelSdk.start()
  started = true
  return true
}

export async function shutdownTracing() {
  if (!otelSdk || !started) return
  await otelSdk.shutdown()
  started = false
  otelSdk = null
}
