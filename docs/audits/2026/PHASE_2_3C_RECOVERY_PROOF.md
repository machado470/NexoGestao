---
status: evidence-harness-ready
owner: nexogestao
last_reviewed: 2026-09-13
---

# Phase 2.3C — operational recovery proof

This document records factual observations only. It is not an availability claim, an SLA, or Phase 2.3D.

## Safe infrastructure and command

The harness uses ephemeral, dedicated services from `docker-compose.phase23c-test.yml`: PostgreSQL database `phase23c` on host port `55433`, and Redis database 15 on host port `56380`. PostgreSQL data is a `tmpfs`; Redis persistence is disabled. No development service, shared volume, `FLUSHALL`, external webhook, Meta, or Z-API endpoint is used. The test helper refuses destructive actions unless both URLs exactly identify these test resources.

Run from the repository root:

```bash
./scripts/run-phase23c-recovery.sh
```

The runner brings up the isolated services, applies the Prisma schema, runs only the three opt-in suites with `RUN_REAL_INTEGRATION=true`, and always executes `docker compose down --volumes --remove-orphans` through a shell trap. Every destructive Jest suite also restores a stopped service in `afterAll`; queue records and database fixtures use unique IDs and are deleted without touching unrelated queues or organizations.

If `RUN_REAL_INTEGRATION` is absent, Jest reports each suite as skipped. A skipped suite is not evidence of a successful recovery test.

## Evidence matrix

| Scenario | Before | Introduced failure | During failure | Recovery / result |
| --- | --- | --- | --- | --- |
| REAL POSTGRES | Readiness `ready`; `SELECT 1`; fixture present | Compose stops only `postgres-phase23c` | Readiness throws 503 with `not_ready`; database and Prisma checks are false; response is checked for DSN/password/client leakage and does not invent a successful database check | Compose starts the same ephemeral container; the suite polls the normal Prisma query path (no application restart or artificial reconnect); readiness returns `ready` and the original fixture is read. Detection/recovery milliseconds are logged as approximate observations, not an SLA. |
| REAL REDIS / BULLMQ | Readiness is `ready`, queue status is available, and a real enqueue returns a job ID | Compose stops only `redis-phase23c` | Readiness throws 503, queue status becomes unavailable, enqueue rejects explicitly, and the factual enqueue-failure counter increments; the readiness database probe remains successful | Compose starts Redis; the existing ioredis/QueueService reconnects without application restart; readiness returns `ready`, and a new job is enqueued and consumed by a real Worker. |
| REAL BULLMQ webhook DLQ | Two persisted organizations; endpoint belongs to A; local HTTP server returns 503 | A delivery payload/meta claims B and supplies non-authoritative trace-like data | Real worker performs two configured attempts, delivery becomes `FAILED`, retry/failed/dead-letter counters increase, and `webhooks-dlq` contains the item. Listing/replay as B cannot see or mutate it. | Local destination switches to 204. The official `replayFailedDelivery` path moves `FAILED` to `PENDING`; worker persists `SUCCESS`. A second replay is rejected and only one successful local HTTP effect exists. The delivery is not simultaneously listed pending and successful. |
| REAL BULLMQ stalled | Isolated queue, QueueEvents and Worker; only harness intervals are reduced | First Worker is force-closed after acquiring the job lock | BullMQ emits `stalled`; process-local count and timestamp are recorded by the test observer; no current-stalled gauge is introduced | A replacement Worker completes the same job according to BullMQ policy. This remains opt-in because process scheduling can affect event timing; it uses a 10-second bound rather than a long sleep. |

## Scope and gaps

- **PostgreSQL down/recovery:** harnessed as a real proof; expected recovery is automatic through the existing Prisma client. It must be classified as proved only after the opt-in command completes in a Docker-capable environment.
- **Redis down/recovery:** harnessed as a real proof; expected recovery is automatic through the existing ioredis connection. It must be classified as proved only after that run completes.
- **Webhook DLQ/replay:** real BullMQ, real PostgreSQL, real retries, deterministic local HTTP failure/recovery, official replay, and A/B isolation are covered. Correlation/request IDs are sent through the queue payload. The suite checks factual in-process metric counters.
- **WhatsApp DLQ/replay:** **not proved**. The current mock provider would not establish external-provider equivalence, so production provider behavior was not changed merely to facilitate this phase. Existing unit coverage is not relabeled as real evidence.
- **Stalled:** opt-in infrastructure proof. The isolated QueueEvents observer proves BullMQ's event and recovery policy. It does not claim that a `stalled` state is queryable. Production lock/stalled intervals are unchanged.
- **Tracing:** the production processing wrapper already creates/ends processing spans and marks thrown handlers as error. This harness exercises that wrapper and distinct retry invocations, but no test exporter is installed here; exported span status/identity is therefore **not independently observed**. Persisted replay does not preserve an original parent trace because the current schema has no traceparent field.
- **Pub/Sub transitions:** not proved independently. Pub/Sub remains optional and is not used as the critical readiness authority.
- **Secrets/logs:** readiness response leakage is asserted. Full captured-log redaction across ioredis/BullMQ library diagnostics is not yet proved.

## Cleanup evidence

The runner's `EXIT`, `INT`, and `TERM` trap restores/removes both containers and their ephemeral data even when Jest fails. PostgreSQL and Redis suites start their dependency in `afterAll`. The webhook suite closes its processor and fake HTTP server, obliterates only the two known queue names in dedicated Redis DB 15, and deletes only fixtures belonging to its two generated organization IDs.

After a Docker-capable evidence run, retain the command output containing approximate detection/recovery times and run the normal regression gates. Do not convert those sampled times into an SLA.
