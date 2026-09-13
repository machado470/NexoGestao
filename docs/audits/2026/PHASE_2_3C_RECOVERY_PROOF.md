---
status: CLOSED
owner: nexogestao
last_reviewed: 2026-09-13
---

# Phase 2.3C — operational recovery proof

This document records the final factual observations from the real-infrastructure execution that formally closed Phase 2.3C on **2026-09-13**. The tested baseline was `main` after the merge of **PR #1006**. This proof is not an availability or HA claim, an SLA, or the start of Phase 2.3D.

## Safe infrastructure and standalone command

The harness uses ephemeral, dedicated services from `docker-compose.phase23c-test.yml`: PostgreSQL database `phase23c` on host port `55433`, and Redis database 15 on host port `56380`. The PostgreSQL Phase 2.3C-only volume survives the tested `stop`/`start` and is removed by final cleanup; Redis persistence is disabled. The harness does not use a development service, shared volume, `FLUSHALL`, or an external webhook provider.

Run from the repository root:

```bash
./scripts/run-phase23c-recovery.sh
```

The runner starts the isolated Compose project and then performs bounded readiness checks against both published **host** ports. It prefers `pg_isready` for PostgreSQL and `redis-cli PING` for Redis, with bounded host TCP checks when those clients are unavailable. Only after those checks does it run `prisma migrate deploy` and the three opt-in suites. Its trap always runs `docker compose down --volumes --remove-orphans`. This removes the former dependency on manually prewarming the ports.

Without `RUN_REAL_INTEGRATION=true`, Jest skips these suites. A skip is not recovery evidence.

## Final real execution — closure evidence

The consolidated Docker-backed execution completed successfully with `runner_exit=0`:

```text
Test Suites: 3 passed, 3 total
Tests:       5 passed, 5 total
Time:        65.433 s
```

This **3/3 suites, 5/5 tests** result is the final Phase 2.3C proof. Therefore, **Phase 2.3C is CLOSED**.

### Proved

- PostgreSQL down detection and automatic recovery without an application restart.
- Preservation of the PostgreSQL fixture across the real stop/start cycle.
- Approximate PostgreSQL detection time of **6,796 ms** and recovery time of **31,701 ms** in this execution. These samples are observations from one test run, **not an SLA**.
- Redis down detection, explicit fail-closed enqueue while unavailable, automatic recovery, and processing of a newly enqueued job after recovery.
- Webhook HTTP 503 handling, retry, persisted final `FAILED`, real insertion in `webhooks-dlq`, official replay, and the persisted `FAILED -> PENDING -> SUCCESS` transition.
- BullMQ-safe webhook job IDs without `:`.
- Rejection of a second replay after `SUCCESS` and organization isolation exercised by the webhook suite.
- The child BullMQ Worker acquired the original job and was then abruptly terminated with `SIGKILL`.
- The replacement BullMQ Worker emitted `stalled` for that original job ID.
- The real `QueueService` recorded `stalledEvents.automation.count = 1` and a factual `lastStalledAt`.
- `QueueObservabilityService` incremented `queue.job.stalled.automation` to 1, while the fictitious `queue.backlog.stalled.automation` gauge remained absent.
- Reprocessing of the original stalled job, observation of the replacement Worker's `completed` event, and removal of the job after completion according to `removeOnComplete: true`.
- Complete cleanup of the dedicated test infrastructure: containers, network, and the dedicated PostgreSQL volume were removed. No development, staging, or production resource was touched.

The many `ECONNREFUSED` messages emitted during the Redis-down window are expected effects of the deliberate outage and reconnection attempts; they are not separate test failures.

Warnings involving `WHATSAPP_ALLOW_MOCK` are test-environment noise and not failures of this recovery execution. They do not constitute proof of external WhatsApp-provider behavior.

## Evidence matrix

| Scenario | Failure exercised | Latest real result |
| --- | --- | --- |
| PostgreSQL | Stop only `postgres-phase23c`; observe readiness failure; restart the same container | **PASS:** `healthy -> down -> not_ready -> recovery`; normal Prisma path recovered without application restart and the fixture was preserved. Observed detection was ~6,796 ms and recovery was ~31,701 ms (test observations, not SLA). |
| Redis / BullMQ | Stop only `redis-phase23c`; readiness and enqueue fail; restart it | **PASS:** enqueue failed closed, existing service recovered automatically, and a post-recovery job was consumed. Repeated connection-refused diagnostics during the outage were expected. |
| Webhook DLQ/replay | Local destination returns HTTP 503 through configured attempts, then succeeds during official replay | **PASS:** retry, final `FAILED`, real `webhooks-dlq` entry with BullMQ-safe job ID, official `FAILED -> PENDING -> SUCCESS` replay, blocked second replay, and tenant isolation were observed. |
| BullMQ stalled | Acquire a canonical `automation` job, kill its lock owner with `SIGKILL`, start a replacement Worker | **PASS:** the original job lost its lock; the recovery Worker emitted `stalled`; `QueueService` recorded `stalledEvents.automation` and factual `lastStalledAt`; `queue.job.stalled.automation` incremented; the job was reprocessed; `completed` was observed; and the job was then removed per `removeOnComplete: true`. |

## Stalled proof contract satisfied

The Redis outage producer remains fail-fast with `maxRetriesPerRequest: 1`, `enableOfflineQueue: false`, and `connectTimeout: 1000`. The readiness probe is separate: it retains one connection, permits normal initial command handling, waits for `ready`, performs `PING`, and closes in `finally`. Worker and QueueEvents auxiliary connections retain their BullMQ blocking/retry semantics.

After reachability succeeds, the test creates a fresh production `QueueService`, waits for its tracked auxiliary clients, and obliterates only the canonical `automation` queue in dedicated Redis database 15. A harness Worker acquires the job and is force-closed so its lock expires; a replacement Worker then applies BullMQ's recovery policy. Within the 30-second harness timeout, proof requires all of these facts:

- `status.stalledEvents.automation.count >= 1`;
- `status.stalledEvents.automation.lastStalledAt` is defined;
- metric `queue.job.stalled.automation >= 1`;
- metric `queue.backlog.stalled.automation` is absent; and
- the replacement Worker's `completed` event reports the original job ID; and
- `queue.getJob(originalJobId)` eventually returns `undefined`, consistently with the real `removeOnComplete: true` default.

The final real run satisfied this complete **`stalled -> recovery -> completed`** contract. Production lock/stalled intervals, `QUEUE_DEFAULT_JOB_OPTIONS`, and `QueueService` remain unchanged.

## Scope, limitations, and residuals

- This recovery proof must not be transformed into a claim of HA or SLA.
- All WhatsApp providers are not proved. In particular, external-provider DLQ/replay is not proved; the local webhook proof is not relabeled as provider equivalence.
- Exported tracing is not independently observed because this harness installs no test exporter. Persisted replay has no original parent trace field in the current schema.
- Pub/Sub degradation and recovery were not exercised and are not proved; Pub/Sub is not the readiness authority.
- Readiness response leakage is asserted, but full captured-log redaction across third-party ioredis/BullMQ diagnostics is not proved.
- Phase 2.3D has not started.

## Cleanup evidence

The runner's `EXIT`, `INT`, and `TERM` trap removes both containers and their ephemeral data even when Jest fails. Each destructive suite also restores a stopped dependency in `afterAll`. The webhook suite closes its processor and local HTTP server, removes only its known queues in dedicated Redis DB 15, and deletes only its generated organization fixtures.

Final cleanup was confirmed: the Phase 2.3C containers, Compose network, and dedicated PostgreSQL volume were removed. No development, staging, or production resource was changed or removed.
