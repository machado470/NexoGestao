import { NodeSDK } from '@opentelemetry/sdk-node'
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus'

const OTEL_SERVICE_NAME = process.env.OTEL_SERVICE_NAME || 'nexogestao-api'
const METRICS_PORT = Number(process.env.OTEL_METRICS_PORT || '9464')
const METRICS_ENDPOINT = process.env.OTEL_METRICS_ENDPOINT || '/metrics'

const prometheusExporter = new PrometheusExporter({
  port: METRICS_PORT,
  endpoint: METRICS_ENDPOINT,
})

export const otelSdk = new NodeSDK({
  serviceName: OTEL_SERVICE_NAME,
  metricReader: prometheusExporter,
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-http': { enabled: true },
      '@opentelemetry/instrumentation-ioredis': { enabled: true },
      '@opentelemetry/instrumentation-redis-4': { enabled: true },
      '@opentelemetry/instrumentation-pg': { enabled: true },
      '@opentelemetry/instrumentation-mysql2': { enabled: true },
      '@opentelemetry/instrumentation-nestjs-core': { enabled: true },
    }),
  ],
})

export async function startTracing() {
  await otelSdk.start()
}
