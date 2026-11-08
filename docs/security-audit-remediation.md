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
Dependency advisory upgrades are a separate follow-up. No production database,
production sessions, deployment or secrets were changed by this implementation.

## Integration blocker confirmed on the baseline

The broad AppModule integration run cannot initialize WhatsAppModule because its
HealthModule import is undefined in the Health/Dashboard/Governance/Finance cycle.
The same canonical-operational-workflow test failed with the same stack on the
unmodified `e08dfaf0` baseline in an isolated worktree using the same installed
dependencies. This is a pre-existing integration blocker, not a passing full E2E
result. It needs a separate module dependency repair before release.

The Phase 2.3C recovery suites additionally require their own exact dedicated
Compose endpoints and correctly refused the generic disposable test database.
Their recovery/fault-injection behavior was not validated in this run.

## Local verification results

- API unit/HTTP/security suite: 125 suites, 697 tests passed.
- Web/BFF suite: 76 files, 576 tests passed.
- Real PostgreSQL security regression suite: 5 tests passed.
- Prisma schema validation, client generation, and all migrations on a disposable
  PostgreSQL database: passed.
- API and web TypeScript checks, API/frontend/BFF builds, web operating-system
  lint, and git diff whitespace check: passed.
- Broad application integration is not green: baseline startup cycle described
  above remains unresolved. The full aggregate ci:preflight was not claimed.

Local commands used installed binaries. For the Prisma preflight helper, the
environment's newer pnpm needed dependency auto-install and package-manager
auto-switch disabled; the declared package manager/lockfile were not changed.
