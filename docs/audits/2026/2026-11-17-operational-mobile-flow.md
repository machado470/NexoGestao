# Operational modules on mobile

Mobile navigation (<768px) in Appointments, Service Orders and People now switches from the list to the selected detail. A named back control restores the still-mounted list, keeping its filters and pagination. Keyboard focus returns to the originating control when possible. Record deep links in Appointments and Service Orders open details directly; loading, missing and failed record states have a visible recovery path.

Search remains visible in the list and extra filters expand on demand. Desktop retains master/detail content and visible filters. Long names and badges wrap inside available width; inputs use 16px text and controls have 44px height. Service-order lists no longer use a nested height-limited scroller on phones. Keyboard events from nested action buttons no longer trigger the parent card's detail-opening shortcut.

Service-order actions precede secondary context and history. On mobile, lifecycle buttons not applicable to the current persisted state are hidden rather than filling the action bar with disabled alternatives. Permission and action checks are unchanged. Context/history expands on mobile and is visible on desktop. Appointments similarly collapses historical evidence.

Finance has mobile cards for the authoritative queue and charges, while retaining desktop tables. Both responsive presentations call the same extracted action renderers, including payment and cancellation. Amounts, linked service order, recorded payments/refunds and official status/reason remain visible in cards or expandable details. The summary is compact and the priority queue expands on mobile. No decision, financial mutation, authorization or API contract was changed.

Validation:
- 50 web tests across appointments, service-order contracts/UI, people, finance navigation/manual-payment contracts and mobile record loading/error/empty controls.
- Web TypeScript and production Vite build.
- Chromium touch fixtures at 320, 375, 390 and 430px: opening and returning from each detail; no horizontal page overflow with long names; finance payment and cancellation dialogs reachable without submitting. Desktop finance tables remain visible. Missing appointment deep link offers a way back. No JavaScript exceptions or tRPC mutation requests in the fixture run.
- Screenshots of all four modules inspected. API responses were simulated; authenticated Railway and physical Safari checks remain outstanding.

Currency/timezone investigation: organization preferences are currently exposed through an ADMIN-only settings endpoint, charges persist their own currency, and schedule controls use browser-local time conversion. Consistent correction therefore needs a dedicated preference/record-currency contract and aligned display/input conversion. This patch does not relabel or convert existing financial amounts or reinterpret stored instants.

Deploy web after merge. No API update or database migration is required for this patch.
