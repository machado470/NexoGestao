# Customers: mobile list and detail layout

On phones (<768px), customers now opens on the wallet with search and expandable filters above results. Selecting “Ver cliente” or the customer name opens a dedicated detail view; “Voltar aos clientes” restores the wallet and its current filters/page. A customerId deep link opens details directly. Desktop retains the operational workspace and table.

Mobile details show the customer's name and contact at full width, the authoritative status/priority, a single recommended action, and the existing secondary-actions menu. Pending balance, open orders and the next appointment are compact. Finance, services/appointments, operational analysis and history expand on demand. Existing permission checks and authoritative action handlers are reused; no API or business rules change.

The mobile application topbar fits menu, compact global search, notifications and account controls on one row. Search inputs use 16px text to avoid iPhone focus zoom. Customer controls have 44px touch targets. Cards and status labels wrap rather than exceed their available width. Notification popup width is constrained to the viewport, and content allows bottom safe-area padding.

Validation:
- Customer operational-center, architecture guardrails and notification-route regression tests.
- Web TypeScript and production Vite build.
- Chromium with touch emulation and intercepted local API responses at 320, 375, 390 and 430px: wallet/detail without horizontal page overflow, long customer names, expanding finance/history, back to wallet, retained filters, search, no-results state and secondary menu. A 1366px render confirms desktop workspace/table layout remains available. No page JavaScript errors.
- Screenshots inspected for the initial wallet and collapsed detail. Live Railway API integration and Safari on a physical iPhone were not tested.

Deployment requires the web service update only. No schema migration or API deployment is required.
