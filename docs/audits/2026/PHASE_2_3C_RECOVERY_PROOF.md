---
status: first-real-run-partial-remediation-ready
owner: nexogestao
last_reviewed: 2026-09-13
---

# Phase 2.3C — operational recovery proof

This document records factual observations only. It is not an availability claim, an SLA, or Phase 2.3D.

## Safe infrastructure and command

The harness uses ephemeral, dedicated services from `docker-compose.phase23c-test.yml`: PostgreSQL database `phase23c` on host port `55433`, and Redis database 15 on host port `56380`. PostgreSQL uses the Phase 2.3C-only named volume `phase23c-postgres-data`, which survives the tested `stop`/`start` and is deleted by the runner's final `down --volumes`; Redis persistence is disabled. No development service, shared volume, `FLUSHALL`, external webhook, Meta, or Z-API endpoint is used. The test helper refuses destructive actions unless both URLs exactly identify these test resources.

Run from the repository root:

```bash
./scripts/run-phase23c-recovery.sh
```

The runner brings up the isolated services, applies the repository's real migration history with `prisma migrate deploy`, runs only the three opt-in suites with `RUN_REAL_INTEGRATION=true`, and always executes `docker compose down --volumes --remove-orphans` through a shell trap. Every destructive Jest suite also restores a stopped service in `afterAll`; queue records and database fixtures use unique IDs and are deleted without touching unrelated queues or organizations.

If `RUN_REAL_INTEGRATION` is absent, Jest reports each suite as skipped. A skipped suite is not evidence of a successful recovery test.

## First real execution — observed evidence

The first Docker-backed execution exposed both harness defects and a production defect. The run is **partial evidence**, not a passing Phase 2.3C claim:

- **Redis down/recovery: PROVED in this execution.** The existing QueueService rejected enqueue while Redis was unavailable and recovered after the real service restart.
- **PostgreSQL down detection: PROVED.** Readiness factually returned `not_ready` with both `checks.database.ok` and `checks.prismaClient.ok` false.
- **PostgreSQL recovery: NOT YET PROVED.** The suite aborted on a contradictory leakage assertion which rejected the legitimate `prismaClient` contract key. The assertion now permits that key while continuing to reject actual connection material, raw errors, stacks, Prisma internals, and filesystem details; another real run is required to prove `ready -> not_ready -> ready` and fixture preservation.
- **Webhook retries and persisted `FAILED` status: OBSERVED.**
- **Webhook DLQ: FAILED because of a real production bug.** The real BullMQ infrastructure rejected colon-delimited custom IDs (`Custom Id cannot contain :`), leaving the DLQ empty. This was discovered by the real infrastructure, not by a mock. Dispatch, official replay, and DLQ now share stable BullMQ-safe hyphenated ID helpers.
- **Complete webhook replay: NOT YET PROVED.** A new real run must still demonstrate the DLQ item and metric, official replay to a 2xx destination, persisted `SUCCESS`, blocked second replay, and organization isolation.
- **Stalled handling: NOT YET PROVED.** The previous harness reused QueueEvents immediately after the Redis stop/start scenario. The stalled proof now creates a fresh production QueueService after a positive Redis probe, waits for its tracked QueueEvents/JobScheduler clients to be ready, and polls the real event/counter and replacement-worker completion for up to 30 seconds.
- **Cleanup: PROVED.** The run restored and removed its dedicated infrastructure as designed.
- **WhatsApp external provider behavior: NOT CLAIMED.** No real provider was exercised.

### Custom BullMQ job ID audit

The repository-wide audit classified `jobId` occurrences as follows:

- **A — custom BullMQ IDs:** webhook dispatch/replay changed from `webhook:dispatch:<deliveryId>` to `webhook-dispatch-<deliveryId>`; webhook DLQ changed from `webhook:dispatch:dlq:<deliveryId>` to `webhook-dispatch-dlq-<deliveryId>`. The two outbound WhatsApp custom IDs were also colon-delimited and were corrected to `whatsapp-dispatch-<messageId>` and `whatsapp-dispatch-retry-<messageId>`.
- **A — already safe and unchanged:** WhatsApp inbound/replay IDs are hyphenated, notification IDs are SHA-256 hashes, and the Phase 2.3C integration seed ID is hyphenated.
- **B — domain/observability fields:** processor status updates, payload fields, API results, and operational log `jobId` values merely report the BullMQ ID and were not rewritten.
- **C — tests:** webhook dispatch, replay, and DLQ contracts now pin the safe IDs and each explicitly rejects `:`.

## Evidence matrix

The matrix below describes the corrected proof contract for the next run; it does not override the observed/proved classifications above.

| Scenario | Before | Introduced failure | During failure | Recovery / result |
| --- | --- | --- | --- | --- |
| REAL POSTGRES | Readiness `ready`; `SELECT 1`; fixture present | Compose stops only `postgres-phase23c` | Readiness throws 503 with `not_ready`; database and Prisma checks are false; response is checked for DSN/password/client leakage and does not invent a successful database check | Compose starts the same ephemeral container; the suite polls the normal Prisma query path (no application restart or artificial reconnect); readiness returns `ready` and the original fixture is read. Detection/recovery milliseconds are logged as approximate observations, not an SLA. |
| REAL REDIS / BULLMQ | Readiness is `ready`, queue status is available, and a real enqueue returns a job ID | Compose stops only `redis-phase23c` | Readiness throws 503, queue status becomes unavailable, enqueue rejects explicitly, and the factual enqueue-failure counter increments; the readiness database probe remains successful | Compose starts Redis; the existing ioredis/QueueService reconnects without application restart; readiness returns `ready`, and a new job is enqueued and consumed by a real Worker. |
| REAL BULLMQ webhook DLQ | Two persisted organizations; endpoint belongs to A; local HTTP server returns 503 | A delivery payload/meta claims B and supplies non-authoritative trace-like data | Real worker performs two configured attempts, delivery becomes `FAILED`, retry/failed/dead-letter counters increase, and `webhooks-dlq` contains the item. Listing/replay as B cannot see or mutate it. | Local destination switches to 204. The official `replayFailedDelivery` path moves `FAILED` to `PENDING`; worker persists `SUCCESS`. A second replay is rejected and only one successful local HTTP effect exists. The delivery is not simultaneously listed pending and successful. |
| REAL BULLMQ stalled | After Redis responds healthy, a fresh production QueueService is created; its tracked QueueEvents/JobScheduler connections must reach `ready`/`connect`. Canonical `automation` is obliterated only in dedicated Redis database 15; only harness Worker intervals are reduced | First Worker is force-closed after acquiring the job lock | The suite polls up to 30 seconds for the real QueueService QueueEvents listener to record `stalledEvents.automation` count/timestamp and increment `queue.job.stalled.automation`; no current-stalled gauge is introduced | A replacement Worker must complete the same job according to BullMQ policy. This is the corrected proof strategy and remains unproved until the next opt-in Docker run passes. |

The Redis outage harness keeps its `QueueService` producer fail-fast (`maxRetriesPerRequest: 1`, offline queue disabled), while every BullMQ Worker and the dedicated connections created by QueueEvents use `maxRetriesPerRequest: null`; all auxiliary clients are tracked and closed. The stalled scenario does not reuse that outage/recovery QueueService. It probes Redis health, constructs a new instance of the same production class with separately tracked auxiliary clients, waits on client state rather than a blind sleep, obliterates only the canonical `automation` queue in dedicated Redis database 15, and interrupts a harness-only Worker with short lock/stalled intervals. It then polls the real `QueueService.getQueueStatus()` state and `QueueObservabilityService` counter before verifying reprocessing, and asserts that no fictional `queue.backlog.stalled.automation` gauge exists.

## Scope and gaps

- **PostgreSQL down/recovery:** down detection is proved; recovery and fixture preservation remain unproved until the corrected opt-in suite completes in a Docker-capable environment.
- **Redis down/recovery:** proved by the first real execution through the existing ioredis connection, without an application restart.
- **Webhook DLQ/replay:** the harness covers real BullMQ, real PostgreSQL, real retries, deterministic local HTTP failure/recovery, official replay, and A/B isolation. Correlation/request IDs are sent through the queue payload and the suite checks factual in-process metric counters, but the full path remains unproved until a corrected run completes.
- **WhatsApp DLQ/replay:** **not proved**. The current mock provider would not establish external-provider equivalence, so production provider behavior was not changed merely to facilitate this phase. Existing unit coverage is not relabeled as real evidence.
- **Stalled:** corrected opt-in infrastructure proof, still unproved. On a passing run, the canonical queue and real QueueService QueueEvents listener must demonstrate BullMQ's event, Nexo counter/timestamp capture, and recovery policy. It does not claim that a `stalled` state is queryable. Production lock/stalled intervals are unchanged.
- **Tracing:** the production processing wrapper already creates/ends processing spans and marks thrown handlers as error. This harness exercises that wrapper and distinct retry invocations, but no test exporter is installed here; exported span status/identity is therefore **not independently observed**. Persisted replay does not preserve an original parent trace because the current schema has no traceparent field.
- **Pub/Sub transitions:** not proved independently. Pub/Sub remains optional and is not used as the critical readiness authority.
- **Secrets/logs:** readiness response leakage is asserted. Full captured-log redaction across ioredis/BullMQ library diagnostics is not yet proved.

## Cleanup evidence

The runner's `EXIT`, `INT`, and `TERM` trap restores/removes both containers and their ephemeral data even when Jest fails. PostgreSQL and Redis suites start their dependency in `afterAll`. The webhook suite closes its processor and fake HTTP server, obliterates only the two known queue names in dedicated Redis DB 15, and deletes only fixtures belonging to its two generated organization IDs.

After a Docker-capable evidence run, retain the command output containing approximate detection/recovery times and run the normal regression gates. Do not convert those sampled times into an SLA.
