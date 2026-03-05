# Mapa de Integração NexoGestão

Este documento mapeia as páginas e componentes do frontend para suas respectivas ações, endpoints no backend (NestJS) e o status da implementação.

| Domínio | Página/Componente | Ação | Endpoint (NestJS) | Status | Observação |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Auth** | Login | Autenticar | `POST /auth/login` | ✅ Existia | |
| | Register | Criar Org + Admin | `POST /bootstrap/first-admin` | ✅ Existia | |
| | ForgotPassword | Recuperar senha | `POST /auth/forgot-password` | ❌ Faltando | Implementar no backend |
| | ResetPassword | Redefinir senha | `POST /auth/reset-password` | ❌ Faltando | Implementar no backend |
| | Logout | Encerrar sessão | `POST /auth/logout` | ✅ Existia | |
| **Me** | Global | Obter dados usuário | `GET /me` | ✅ Existia | |
| **Customers** | CustomersPage | Listar clientes | `GET /customers` | ✅ Existia | |
| | CreateCustomerModal | Criar cliente | `POST /customers` | ✅ Existia | |
| | EditCustomerModal | Atualizar cliente | `PATCH /customers/:id` | ✅ Existia | |
| | DetailModal | Obter cliente | `GET /customers/:id` | ✅ Existia | |
| **People** | PeoplePage | Listar pessoas | `GET /people` | ✅ Existia | |
| | CreatePersonModal | Criar pessoa | `POST /people` | ✅ Existia | |
| | EditPersonModal | Atualizar pessoa | `PATCH /people/:id` | ❌ Faltando | Implementar no backend |
| **Appointments** | AppointmentsPage | Listar agendamentos | `GET /appointments` | ✅ Existia | |
| | CreateAppointmentModal | Criar agendamento | `POST /appointments` | ✅ Existia | |
| | DetailModal | Obter agendamento | `GET /appointments/:id` | ✅ Existia | |
| | EditAppointmentModal | Atualizar agendamento | `PATCH /appointments/:id` | ✅ Existia | |
| **Service Orders** | ServiceOrdersPage | Listar O.S. | `GET /service-orders` | ✅ Existia | |
| | CreateServiceOrderModal | Criar O.S. | `POST /service-orders` | ✅ Existia | |
| | DetailModal | Obter O.S. | `GET /service-orders/:id` | ✅ Existia | |
| | EditServiceOrderModal | Atualizar O.S. | `PATCH /service-orders/:id` | ✅ Existia | |
| **Finance** | FinancesPage (Charges) | Listar cobranças | `GET /finance/charges` | ✅ Existia | |
| | CreateChargeModal | Criar cobrança | `POST /finance/charges` | ❌ Faltando | Implementar no backend |
| | EditChargeModal | Atualizar cobrança | `PATCH /finance/charges/:id` | ❌ Faltando | Implementar no backend |
| | DetailModal | Obter cobrança | `GET /finance/charges/:id` | ✅ Existia | |
| | FinancesPage (Stats) | Estatísticas cobranças | `GET /finance/charges/stats` | ❌ Faltando | Implementar no backend |
| | FinancesPage (Revenue) | Faturamento mensal | `GET /finance/charges/revenue-by-month` | ❌ Faltando | Implementar no backend |
| | ExpensesPage | Listar despesas | `GET /finance/expenses` | ❌ Faltando | Implementar no backend |
| | CreateExpenseModal | Criar despesa | `POST /finance/expenses` | ❌ Faltando | Implementar no backend |
| | InvoicesPage | Listar faturas | `GET /finance/invoices` | ❌ Faltando | Implementar no backend |
| | CreateInvoiceModal | Criar fatura | `POST /finance/invoices` | ❌ Faltando | Implementar no backend |
| | LaunchesPage | Listar lançamentos | `GET /finance/launches` | ❌ Faltando | Implementar no backend |
| | CreateLaunchModal | Criar lançamento | `POST /finance/launches` | ❌ Faltando | Implementar no backend |
| **Governance** | GovernancePage | Listar governança | `GET /governance/runs` | ✅ Existia | Adaptar para o front |
| | GovernancePage | Resumo de risco | `GET /governance/summary` | ✅ Existia | Adaptar para o front |
| | GovernancePage | Auto Score | `GET /governance/auto-score` | ❌ Faltando | Implementar no backend |
| **Dashboard** | Dashboard | Métricas gerais | `GET /dashboard/metrics` | ✅ Existia | |
| | Dashboard | Faturamento | `GET /dashboard/revenue` | ✅ Existia | |
| | Dashboard | Crescimento | `GET /dashboard/growth` | ✅ Existia | |
| | Dashboard | Status O.S. | `GET /dashboard/service-orders-status` | ✅ Existia | |
| | Dashboard | Status Cobranças | `GET /dashboard/charges-status` | ✅ Existia | |
| | ExecutiveDashboard | Relatório Executivo | `GET /reports/executive-report` | ✅ Existia | |
| | ExecutiveDashboard | Métricas Executivas | `GET /reports/metrics` | ✅ Existia | |
| **WhatsApp** | WhatsAppPage | Listar mensagens | `GET /whatsapp/messages/:customerId` | ❌ Faltando | Implementar no backend |
| | WhatsAppPage | Enviar mensagem | `POST /whatsapp/messages` | ❌ Faltando | Implementar no backend |
| | WhatsAppPage | Atualizar status | `PATCH /whatsapp/messages/:id/status` | ❌ Faltando | Implementar no backend |
| **Onboarding** | Onboarding | Criar pessoa | `POST /people` | ✅ Existia | |
| | Onboarding | Finalizar | `POST /onboarding/complete` | ✅ Existia | |
| **Notifications** | Global | Listar notificações | `GET /notifications` | ❌ Faltando | Implementar no backend (Opcional) |

## Próximos Passos
1. Implementar endpoints financeiros faltantes no `FinanceController`.
2. Adicionar métodos de Auth (Forgot/Reset) no `AuthController`.
3. Criar `WhatsAppController` no backend.
4. Atualizar o proxy no `apps/web/server/routers/nexo-proxy.ts` para refletir os novos endpoints.
5. Garantir que o frontend use os endpoints corretos via tRPC -> Proxy -> NestJS.
