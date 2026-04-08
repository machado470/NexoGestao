# Revisão de Produto e UX — NexoGestao (Frontend + BFF)

Data: 2026-04-08
Escopo: `apps/web/client/src` com foco em prontidão SaaS para venda.

## 1) Mapeamento de páginas e rotas

### Páginas encontradas (`apps/web/client/src/pages`)
About, AcceptInvitePage, AppointmentsPage, AuthCallbackPage, BillingPage, CalendarPage, ConfirmEmailPage, CustomersPage, ExecutiveDashboard, ExecutiveDashboardNew, FinancesPage, ForgotPasswordPage, GovernancePage, Landing, Login, NotFound, Onboarding, PeoplePage, PrivacyPolicy, Register, ResetPasswordPage, ServiceOrdersPage, SettingsPage, TermsOfService, TimelinePage, WhatsAppPage.

### Cobertura de rotas
- Rotas públicas: `/`, `/login`, `/register`, `/forgot-password`, `/reset-password`, `/auth/accept-invite`, `/auth/callback`, `/auth/confirm-email`, `/about`, `/privacy`, `/terms`, `/404`.
- Rotas protegidas: `/customers`, `/appointments`, `/service-orders`, `/finances`, `/people`, `/governance`, `/executive-dashboard`, `/whatsapp`, `/calendar`, `/settings`, `/timeline`, `/billing`.
- Aliases legados ativos para compatibilidade: `/dashboard`, `/executive-dashboard-new`, `/launches`, `/invoices`, `/expenses`, `/referrals`, `/operations`, `/dashboard/operations`.

### Achados estruturais
- Não foram identificadas páginas “órfãs” sem rota funcional no shell principal.
- `ExecutiveDashboardNew` é usado por `ExecutiveDashboard` (não órfão), mas mantém naming legado.
- Há aliases legados válidos e intencionais; remover sem telemetria pode quebrar deep links antigos.

## 2) Detecção de problemas UX/produto

### Botões sem handler
- Não foram encontrados botões `button` sem ação em `src/pages`.

### Modais inconsistentes
- Modais de criação/edição estão conectados nas páginas operacionais críticas (clientes e O.S.), com fallback de recarga.

### Loaders travados / risco de estado morto
- Risco observado no logout quando dependente de resposta de rede: usuário poderia ficar aguardando tempo excessivo em ambientes degradados.

### Queries sem fallback
- Billing tinha comportamento de carregamento/erro menos padronizado que as demais telas core.

## 3) Correções aplicadas

1. **Padronização de layout e fluxo em Billing**
   - Migrado para padrão de página com `PageShell + PageHero + SmartPage + SurfaceSection`.
   - Adicionado bloco de KPI e CTA principal por página (upgrade).
   - Padronizado estado de loading/erro com `getQueryUiState` e `EmptyState`.
   - Mantida compatibilidade com APIs e mutations existentes (`billing.*`).

2. **Correção crítica de logout resiliente**
   - Adicionado timeout de segurança no fluxo de logout do `MainLayout`.
   - Em timeout, aplicação força redirecionamento para `/login` com marcador de fallback, evitando bloqueio perceptível.

## 4) Melhorias de fluxo (next action + SaaS readiness)

- Billing agora expõe “próxima ação” com CTA orientada a desbloqueio de receita.
- Mantido alinhamento com páginas já orientadas a ação (`ServiceOrders`, `Finances`, `Customers`) sem alterar APIs.
- Integração WhatsApp com cobrança permanece nos fluxos de Financeiro/O.S. já conectados.

## 5) Remoção de legado

- Não removido alias legado nesta etapa para evitar quebra de navegação histórica.
- Recomendação: remover aliases em duas fases (telemetria → sunset), após confirmar baixa utilização.

## 6) Próximos passos sugeridos

1. Criar feature flag para sunset de aliases (`/launches`, `/invoices`, etc.) com métrica de acesso.
2. Consolidar nomenclatura de dashboard (`ExecutiveDashboardNew`) para reduzir dívida semântica.
3. Definir checklist de “Definition of Done SaaS” para todas páginas: Hero, KPI, Lista/Fila, CTA primária, loading, erro, empty state.
4. Rodar auditoria automatizada de rotas e handlers em CI para prevenir regressões.
