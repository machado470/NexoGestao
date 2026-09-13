# Phase 2.3B — metrics and asynchronous correlation

## Existing telemetry audit

The application starts one OpenTelemetry `NodeSDK` and one `PrometheusExporter` only when
`OTEL_ENABLED=true`. HTTP, NestJS, ioredis, PostgreSQL and mysql2 auto-instrumentation already
use that SDK. Custom instruments use the global API meter and therefore share its
`MeterProvider`; they do not listen on another port. `OTEL_METRICS_PORT` must only be reachable
from an administrative/internal network. Authentication and access control are deployment
responsibilities, not exporter middleware.

All legacy snapshots below are **process-local**. Prometheus is the aggregation path across
replicas. No scrape callback queries PostgreSQL or Redis. `QueueMetricsExporterService` remains
a JSON projection of the queue snapshot; it is not a Prometheus exporter or another store.

| Source/current values | Correct type/unit | Cardinality and export decision |
| --- | --- | --- |
| `MetricsService`: executions, charges, payments, idempotency and integration failures | counter, `{event}` | Exported as `nexo_domain_operations_total`; finite `operation` and `status`. |
| `MetricsService`: execution/finance status | counter, `{event}` | Same instrument; closed status unions only. |
| `MetricsService`: provider timeout suffix | counter, `{event}` | Not exported: suffix is currently unconstrained. |
| `MetricsService`: request/error/latency by endpoint | counters and histogram, `{request}`/`ms` | Snapshot only. The middleware heuristic cannot prove a route template for every URL, and HTTP auto-instrumentation already covers HTTP telemetry. |
| `QueueObservabilityService`: enqueue, stalled, retry, failure and DLQ events | counter, `{event}` | `nexo_queue_events_total`; queue is checked against `QUEUE_NAMES`, operation/status are fixed mappings. Unknown names stay snapshot-only. |
| Queue processing timings | histogram, `ms` | `nexo_queue_processing_duration`; only fixed webhook/WhatsApp operations. |
| Queue waiting/active/delayed/failed snapshots | observable gauge, `{job}` | `nexo_queue_jobs`; observations only come from the existing explicit factual `getJobCounts` collection. No scrape polling. |
| `WhatsAppObservabilityService` lifecycle totals | counter, `{event}` | `nexo_whatsapp_events_total`; fixed operation/status pairs. |
| WhatsApp processing samples | histogram, `ms` | `nexo_whatsapp_processing_duration`. The legacy array/average remains process-local for compatibility. |

No custom HTTP metric was added because the SDK HTTP instrumentation is the suitable equivalent.
No custom metric label contains tenant/entity/job/request/correlation/trace identifiers, arbitrary
URLs, payloads, or free text.

## Asynchronous trace contract

`QueueService.addJob` calls OpenTelemetry `propagation.inject` and retains only `traceparent` and
`tracestate` under `meta.traceContext`; baggage is intentionally excluded. Existing sanitized
`requestId` and `correlationId` remain at both their compatible top-level positions and `meta`.
The payload's existing `orgId` is untouched and trace context is never consulted for tenancy.

The automation, finance, notification, webhook and WhatsApp workers call the common
`processJobWithTracing` boundary. It filters the carrier again, extracts it, and uses
`startActiveSpan`/`context` semantics. A valid parent keeps the trace and creates a new span;
exceptions are recorded, error status is set, and the span is always ended. Without a carrier,
the tracer's normal policy creates a root processing span when a real SDK is active; no manual
trace ID is generated and no `traceId` is written into the job. Span attributes are limited to
the fixed messaging system, allowlisted queue, and fixed `process` operation. Operational IDs
remain log context, not metric dimensions or indexed span attributes.

The WhatsApp DLQ consumer and webhook DLQ handling are not independently wrapped in this change;
the main producers and processing workers are covered. BullMQ retry/failure listeners run outside
the processing active span but preserve durable IDs in their existing structured logs.

## Outbox and residual risks

The outbox already persists `correlationId`, which remains the durable operational bridge. No
schema or migration was added merely for trace context. Consequently, a process restart between
outbox persistence and dispatch does not preserve a distributed parent trace; persisting a W3C
carrier requires a separate data-retention/schema decision.

The endpoint snapshots and unconstrained provider-timeout suffix should only become exportable
after stable route/provider allowlists exist. Queue gauges describe a factual sample collected by
an explicit status request, not availability or historical state. Phase 2.3C should validate
failure behavior under destructive Redis/PostgreSQL scenarios without changing these metric
semantics or treating persisted history as availability.
