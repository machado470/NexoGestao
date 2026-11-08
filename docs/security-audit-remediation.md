# Security audit remediation — 2026-11-08

This change closes the public Google profile-to-session bridge, preserves explicit
MANAGER restrictions, revalidates JWT sessions against persisted account state,
revokes sessions after password resets, restricts webhook egress, and fixes named
authentication throttles.

## Deployment

1. Apply the additive Prisma migration `20261108000000_add_user_session_version`
   before starting the new API. Generate Prisma Client from the updated schema.
2. Deploy API and BFF together. The Google bridge now accepts `{ idToken }` only;
   clients sending an asserted email/profile are intentionally rejected.
3. Existing JWTs have no session version and will receive 401. Users must sign in
   again. This intentionally invalidates all sessions issued before this fix.
4. Configure the same `GOOGLE_CLIENT_ID` for the BFF code exchange and API token
   audience validation. Permit API HTTPS access to
   `https://www.googleapis.com/oauth2/v3/certs` for Google signing keys. Tokens are
   verified against the configured audience, Google issuer, RS256 signature,
   expiry, subject, and verified email. Key fetch failures fail closed.
5. Existing webhook destinations must use HTTPS on port 443 with valid public
   certificates and public IP destinations. Loopback/private/link-local targets,
   credentials in URLs, and redirects are rejected, including at dispatch time.
   Delivery failures continue through the existing retry/DLQ mechanism.

The webhook transport resolves DNS once and pins a validated public address to
that HTTPS connection, preserving hostname certificate validation. It does not
use an outbound HTTP proxy. Deployments requiring a proxy must provide a secure
public-destination egress design rather than bypassing this protection.

JWT authentication reads the current account and active person from PostgreSQL on
each authenticated request. Disabled/deleted accounts, inactive/missing people,
changed tenant/person/role, and mismatched session versions are rejected. The shared
Prisma middleware increments the session version atomically on User active, role,
password or organization updates, including updateMany/upsert. Password
reset consumes the reset token and increments session version atomically. Explicit
legacy MANAGER permissions remain distinct from STAFF. Canonical OPERADOR grants
still include both legacy operator roles when a route explicitly declares that
canonical permission.

This change checks sessions at request authentication time. It does not terminate
already-open SSE streams immediately; their existing expiry/connection lifecycle
still applies. Direct person disable/re-enable checks the current active state without permanently
revoking its linked account sessions. Account disable/re-enable permanently revokes
previous sessions through the shared User mutation middleware. Administrative
revoke-all can also increment sessionVersion explicitly.

## Validation scope

Regression coverage includes Google signatures/claims and malformed inputs,
email-only impersonation over HTTP, persisted account/role/session revocation,
one-time password reset, STAFF denial on manager routes, the sixth login returning
429, BFF forwarding only an ID token, and webhook IP/DNS/redirect restrictions.

The real PostgreSQL security suite uses the actual AuthModule, Prisma, Passport,
and role guard with a small protected controller to avoid unrelated application
module startup dependencies. The queue replay integration suite has a test-only
transport stub for its controlled HTTP loopback receiver; production transport
policy remains covered by dedicated destination security tests.

Live Google OAuth was not exercised because no Google credentials were configured;
cryptographic checks and BFF callback behavior were tested with controlled fixtures.
No production database, production sessions, deployment or secrets were changed
by this implementation. Remaining advisory migrations are listed below.

## Application bootstrap and CI isolation

WhatsApp previously imported HealthModule only to consume its metrics provider,
creating a Health/Dashboard/Governance/Finance/WhatsApp import cycle. Metrics now
live in the leaf WhatsAppMetricsModule, imported by both Health and WhatsApp. A
complete AppModule compilation test verifies the dependency graph and that both
consumers receive the same provider instance.

The normal integration command excludes only the three Phase 2.3C recovery suites.
CI runs those separately through `scripts/run-phase23c-recovery.sh`, using their
required dedicated PostgreSQL/Redis endpoints and cleanup. Recovery tests are not
silently skipped or run against shared CI services.

## Dependency refresh

The pnpm 10.30.3 lockfile was refreshed within the declared dependency ranges.
Nest stays on major 11; OpenTelemetry uses the compatible SDK 2 family
(sdk-node/exporter 0.223, auto-instrumentations 0.81, API 1.9). The real SDK trace
regression uses the SDK 2 constructor API for span processors. The tracing startup,
Prometheus HTTP endpoint and shutdown were also exercised with telemetry enabled.

Scoped overrides require patched protobufjs 8 and multer 2 versions. tRPC packages
are aligned on 11.16. Vitest was migrated to 4.1.12 (compatible with the project's
Node 20/24 environment) to remove critical test-server and worker-pool advisories.

At the verification snapshot, `pnpm audit --prod --json` reported **0 critical,
0 high, 10 moderate and 1 low** findings. The complete audit including development
reported **0 critical, 0 high, 14 moderate and 2 low**. The original production
snapshot was 1 critical, 47 high, 74 moderate and 13 low. Counts describe advisory
records, not demonstrated application exploits, and may change with the registry.

Remaining production findings require separate compatibility work: Sentry 8 pins
older OpenTelemetry instrumentation/core; uuid 9 has a bounds-check advisory in
v3/v5/v6 while this application imports v4; streamdown pins KaTeX 0.16; Google's
resource detector reaches older glob/minimatch through gaxios/rimraf. These were
not suppressed or overridden across incompatible major versions. See
`docs/security-dependency-advisories.json` for exact versions, paths and links.

## Local verification results after the follow-up

The complete `pnpm ci:preflight` command passed on the final dependency set.

- Full API test command: 130 suites / 721 tests passed; 52 real-infrastructure tests
  are intentionally skipped in that command and exercised by the separate runs.
- Vitest 4 frontend/BFF suite: 76 files / 576 tests passed.
- Main integration command with real PostgreSQL/Redis: 12 suites / 53 tests passed;
  the 8 separately gated suites were run explicitly below.
- Additional isolated execution, governance, operational state, risk, reconciliation
  and Outbox integration: 7 suites / 16 tests passed.
- Pristine-database bootstrap integration: 1 test passed.
- Dedicated Phase 2.3C recovery script: 3 suites / 5 tests passed, including real
  service stop/start and webhook replay; the script cleaned its containers/volume.
- Enabled OpenTelemetry startup, Prometheus HTTP response and shutdown passed.
- Headless Chromium loaded the built login page and rendered its password form.
- TypeScript checks, immutable pnpm installation, Prisma migration/client checks,
  API/frontend/BFF builds, web lint and whitespace validation passed.

No failing broad application integration remains from the earlier dependency cycle.
Real Google OAuth and external telemetry providers were not exercised; no production
configuration was changed.
