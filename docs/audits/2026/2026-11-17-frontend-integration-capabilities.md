# Frontend: account-scoped memory and integration capabilities

This change addresses the first three priorities from the frontend review.

## Account-local state

Operational memory uses an encoded organization/user/key namespace. Missing identity never gets a shared persisted namespace. On identity change, the hook derives the current identity's value before effects run, and writes only matching state to its scope. The setter remains stable within an identity and supports functional updates. Legacy unscoped values are discarded rather than assigned to an unverified owner. Existing filters, selections and drafts will therefore reset once on upgrade. Logout now removes both `nexo:` and the old `nexo.` prefixes; theme preferences remain separate.

## WhatsApp

Presentation distinguishes disabled, misconfigured, unknown, unavailable queue, configured provider and explicit demonstration mode. A successful health response no longer implies a usable channel. History remains accessible. Direct sends, templates, retries and message-delivery workflow actions check channel capability. Non-delivery actions remain available according to their existing authoritative rules. Mock mode explicitly states that messages are not delivered to real numbers. API delivery guards remain authoritative.

## Subscription capabilities

Authenticated GET /v1/billing/availability returns a small strict capability contract: status, eligible checkout plans and cancellation availability. No keys or price identifiers are exposed. Eligible plans require an enabled provider and configured plan price; development simulation remains explicit, while the existing production simulation prohibition stays in place. Cancellation availability preserves local subscription operations and requires configured Stripe for Stripe subscriptions.

The BFF validates this response. The subscription page disables checkout when capability cannot be confirmed or a plan is unavailable and explains disabled/simulation states. Status, catalog and usage remain readable. Checkout/cancellation handlers recheck capability before invoking their mutations. These controls supplement existing server validation; they do not grant privileges or simulate successful billing.

## Validation

- Web: 56 tests covering capability states, malformed BFF outputs, authenticated boundary, identity namespaces/storage failures and existing WhatsApp/Billing/Auth contracts.
- API: 23 tests across billing availability, explicit Stripe-disabled production and quota authority.
- API/web TypeScript checks and production Vite build.
- Chromium against local application with intercepted API fixtures: discard legacy search; independent account A/B searches; restore A after B; logout removes all account memory; unavailable billing buttons disabled; configured eligible plan enabled; WhatsApp visibly disabled. No delivery or checkout mutation was requested, no JavaScript exception, only the intercepted logout mutation.

No live Railway operations, provider messages, e-mails, checkout sessions or financial writes were performed. No database migration is required. Deploy API before web so the capability endpoint exists; old API responses fail closed in the new UI.

Remaining review stages include currency/timezone semantics, mobile layouts for other operational modules, shared form behavior and authenticated Safari/Railway validation.
