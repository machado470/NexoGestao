---
status: real-run-partial-stalled-pending
owner: nexogestao
last_reviewed: 2026-09-13
---

# Phase 2.3C — operational recovery proof

This document records factual observations from the latest real-infrastructure execution. It is not an availability claim, an SLA, or Phase 2.3D.

## Safe infrastructure and standalone command

The harness uses ephemeral, dedicated services from `docker-compose.phase23c-test.yml`: PostgreSQL database `phase23c` on host port `55433`, and Redis database 15 on host port `56380`. The PostgreSQL Phase 2.3C-only volume survives the tested `stop`/`start` and is removed by final cleanup; Redis persistence is disabled. The harness does not use a development service, shared volume, `FLUSHALL`, or an external webhook provider.

Run from the repository root:

```bash
./scripts/run-phase23c-recovery.sh
```

The runner starts the isolated Compose project and then performs bounded readiness checks against both published **host** ports. It prefers `pg_isready` for PostgreSQL and `redis-cli PING` for Redis, with bounded host TCP checks when those clients are unavailable. Only after those checks does it run `prisma migrate deploy` and the three opt-in suites. Its trap always runs `docker compose down --volumes --remove-orphans`. This removes the former dependency on manually prewarming the ports.

Without `RUN_REAL_INTEGRATION=true`, Jest skips these suites. A skip is not recovery evidence.

## Latest real execution — observed evidence

The latest Docker-backed execution completed four tests successfully and left one failure, the stalled scenario.

### Proved

- PostgreSQL down detection and automatic recovery without an application restart.
- Preservation of the PostgreSQL fixture across the real stop/start cycle.
- Approximate PostgreSQL detection time of **4.6 seconds** and recovery time of **8.3 seconds** in this execution. These samples are observations, **not an SLA**.
- Redis down detection, explicit fail-closed enqueue while unavailable, automatic recovery, and processing of a newly enqueued job after recovery.
- Webhook retries, persisted `FAILED`, real DLQ insertion, official replay, and persisted `SUCCESS` after replay.
- Rejection of a second replay after `SUCCESS` and organization isolation exercised by the webhook suite.
- Complete cleanup of the dedicated test infrastructure and fixtures.

The many `ECONNREFUSED` messages emitted during the Redis-down window are expected effects of the deliberate outage and reconnection attempts; they are not separate test failures.

### Not proved yet

- **Stalled end-to-end.** The only failed test was the stalled harness. Its initial readiness polling created a new fail-fast producer connection on every attempt and issued `PING` while each client was still `connecting`. With `enableOfflineQueue: false`, ioredis correctly rejected that command before any one connection could become ready. This is a harness defect, not evidence of a QueueService defect.

The corrected harness now uses one dedicated, lazy readiness connection, awaits its connection readiness, sends `PING`, and always disconnects it. It does not change the fail-fast producer configuration or production runtime. A future real run is required before stalled can be classified as proved.

## Evidence matrix

| Scenario | Failure exercised | Latest real result |
| --- | --- | --- |
| PostgreSQL | Stop only `postgres-phase23c`; observe readiness failure; restart the same container | **PASS:** down detected, normal Prisma path recovered without restart, fixture preserved; observed ~4.6 s detection and ~8.3 s recovery (not SLA). |
| Redis / BullMQ | Stop only `redis-phase23c`; readiness and enqueue fail; restart it | **PASS:** enqueue failed closed, existing service recovered automatically, and a post-recovery job was consumed. Repeated connection-refused diagnostics during the outage were expected. |
| Webhook DLQ/replay | Local destination returns 503 through configured attempts, then 204 for official replay | **PASS:** retries, `FAILED`, DLQ, tenant isolation, official replay to `SUCCESS`, and blocked second replay were observed. |
| BullMQ stalled | Acquire a canonical `automation` job, interrupt its lock owner, start a replacement Worker | **NOT YET PROVED:** the precondition probe failed because it reused producer fail-fast options incorrectly. The corrected test must still observe the real stalled event and completion in real infrastructure. |

## Corrected stalled proof contract

The Redis outage producer remains fail-fast with `maxRetriesPerRequest: 1`, `enableOfflineQueue: false`, and `connectTimeout: 1000`. The readiness probe is separate: it retains one connection, permits normal initial command handling, waits for `ready`, performs `PING`, and closes in `finally`. Worker and QueueEvents auxiliary connections retain their BullMQ blocking/retry semantics.

After reachability succeeds, the test creates a fresh production `QueueService`, waits for its tracked auxiliary clients, and obliterates only the canonical `automation` queue in dedicated Redis database 15. A harness Worker acquires the job and is force-closed so its lock expires; a replacement Worker then applies BullMQ's recovery policy. Within the 30-second harness timeout, proof requires all of these facts:

- `status.stalledEvents.automation.count >= 1`;
- `status.stalledEvents.automation.lastStalledAt` is defined;
- metric `queue.job.stalled.automation >= 1`;
- metric `queue.backlog.stalled.automation` is absent; and
- the job count reaches exactly `completed === 1`.

This changes harness timing only. Production lock/stalled intervals and QueueService are unchanged.

## Scope and remaining gaps

- WhatsApp external-provider DLQ/replay is not proved; the local webhook proof is not relabeled as provider equivalence.
- Exported tracing is not independently observed because this harness installs no test exporter. Persisted replay has no original parent trace field in the current schema.
- Pub/Sub transitions are not independently proved and Pub/Sub is not the readiness authority.
- Readiness response leakage is asserted, but full captured-log redaction across third-party ioredis/BullMQ diagnostics is not proved.
- Phase 2.3D has not started.

## Cleanup evidence

The runner's `EXIT`, `INT`, and `TERM` trap removes both containers and their ephemeral data even when Jest fails. Each destructive suite also restores a stopped dependency in `afterAll`. The webhook suite closes its processor and local HTTP server, removes only its known queues in dedicated Redis DB 15, and deletes only its generated organization fixtures.
