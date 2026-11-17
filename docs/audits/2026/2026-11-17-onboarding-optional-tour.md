# Optional onboarding tour and consistent application theme

New organizations can dismiss the guided tour using “Pular demonstração” at the top or “Continuar sem demonstração” at the bottom. The authenticated ADMIN/MANAGER calls POST /v1/onboarding/skip through the BFF. The server persists requiresOnboarding=false for that organization and returns the actual step evidence. It does not create demo business records or mark incomplete steps as complete. Existing completion endpoints continue to require persisted customer, completed service and linked charge evidence. No database migration is required.

The standalone onboarding route now owns a ThemeProvider and uses the same nexo-app/app-root namespace as MainLayout. Background, cards and fields follow the selected light/dark theme, with a theme control available on the page. The tour explains why each later action is disabled, offers retry for loading assignees, and provides an exit when no assignee exists.

Progress hydration no longer overwrites browser storage before it has been read. The organization/user-scoped entry retains journey IDs with presentation progress and accepts the previous progress-only format. Customer and appointment lists use the shared payload normalizer (including items envelopes). Successful mutations retain visible progress while queries refresh; server evidence still governs final completion. Successful steps scroll to the next form, and errors scroll into view with an alert.

Validation:
- API: 24 onboarding service/HTTP tests, including empty and partial skip, role restrictions, authenticated tenant isolation and unchanged completion evidence checks.
- Web: 38 onboarding output/input, page contract and service lifecycle tests.
- API and web TypeScript checks; Vite production build.
- Chromium against the local application with intercepted API fixtures: full customer → appointment → assigned/in-progress/done service → charge, reload retaining 4/4 progress, skip redirect after session refresh, light/dark screenshots, and 390px layout with no horizontal overflow. These fixtures do not prove live Railway API connectivity.
