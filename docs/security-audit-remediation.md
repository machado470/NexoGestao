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

## Dependency remediation follow-up

The production dependency audit now reports zero findings at every severity.
The complete audit reports zero critical/high/moderate findings and one low
registry advisory for deepmerge 4.3.1. There is no upstream patched release for
GHSA-gcqx-w48m-w2h4. Its vulnerable code is patched locally through pnpm's
`patchedDependencies`, with the patch hash recorded in the lockfile. No advisory
is ignored or suppressed in the audit configuration.

The patch defines own data properties instead of assigning through inherited
setters when constructing merge results. This prevents an own `__proto__` input
key from poisoning the returned object's prototype, without dropping legitimate
data or changing array/custom merge behavior. It covers source, CJS and UMD files.
The regression reproduces the defect before the patch and verifies the actual
copies loaded by Jest and Nest CLI plus the UMD build. Run
`pnpm test:security:dependencies`; it is also part of preflight and CI. Remove the
local patch only after an upstream fix is available and the regression still passes.

Sentry Node, profiling and React move to SDK 10.78, aligned with OpenTelemetry API
1.9.1. UUID moves to 11.1.1; its obsolete external types package is removed. Scoped
resolutions update gaxios 7, glob, minimatch and postcss-selector-parser. Streamdown
keeps its existing API while its math plugin resolves patched KaTeX 0.18.2. This
release preserves the Node 20 compatibility required by the current images. Nest
runtime and CLI remain on major 11; no Node major migration is required.

The native Sentry profiler is allowed in pnpm's build list. The actual SDK and
native profiling were exercised with an in-memory event transport under Node 24
and under Node 20 in an offline container; no events were sent externally. Tests
also cover redaction, disabled/failed initialization, math rendering, Markdown
formatting and untrusted content.

Docker install stages copy the patch before immutable installation and pin pnpm
10.30.3, so a global package-manager upgrade cannot silently omit the patch.
The canonical image accepts an optional build-secret CA for managed proxy trust;
no certificate is copied into an image layer. Local environment files and nested
node_modules are excluded from build contexts.

Exact audit counts and the remediated registry advisory are recorded in
`docs/security-dependency-advisories.json`. Counts are registry advisory records,
not a guarantee that the application is free of all security defects.

## Verification of the remaining-advisories change

- Immutable pnpm 10.30.3 installation and full `pnpm ci:preflight` passed.
- API: 131 suites / 724 tests passed; real-infrastructure suites remain separately
  gated in this command. Web/BFF: 77 files / 580 tests passed.
- Patched dependency regression: 12 cases passed under Node 24 and in an offline
  Node 20 container. The original package failed the poisoning reproductions.
- Main PostgreSQL/Redis integration run: 12 suites / 53 tests passed.
- Actual Sentry SDK/profiling smoke passed with an in-memory transport under both
  Node 24 and Node 20. No external provider credentials or events were used.
- The canonical Docker image reached dependency installation locally, but the full
  image build ran out of the managed environment's 8 GB disk while copying layers.
  Only cache records from that attempt were removed. CI now builds the complete
  image and runs the patched-dependency and compiled API import smoke in it.

Production data and deployment were not changed. This change requires an immutable
install from the committed lockfile; copying manifests without the patch directory
or switching package-manager major versions would invalidate that guarantee.
