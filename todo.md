# NexoGestão SaaS Platform - TODO

## Completed Features
- [x] Landing page with hero section, features, and CTA buttons
- [x] Authentication system (register/login) using tRPC
- [x] Local database (MySQL) with organizations and accounts tables
- [x] Dashboard with sidebar navigation, dark/light theme toggle
- [x] Database migrations for organizations and accounts
- [x] AuthContext with tRPC integration
- [x] Create Customer Modal component
- [x] Create Appointment Modal component
- [x] Create Service Order Modal component
- [x] Integrated modals into Dashboard
- [x] Unit tests for CRUD operations (customers, appointments, service orders)
- [x] Fixed logout test (session.logout instead of auth.logout)
- [x] Implemented bcrypt for password hashing
- [x] Added email and phone validation in forms
- [x] Fixed imports in Dashboard (useAuth hook)
- [x] Verified database schema synchronization

## Fase 1: Tabelas de Dados (CONCLUÍDA)
- [x] Criar componente DataTable reutilizável
- [x] Criar página CustomersPage com tabela de clientes
- [x] Criar página AppointmentsPage com tabela de agendamentos
- [x] Criar página ServiceOrdersPage com tabela de ordens de serviço
- [x] Integrar rotas no App.tsx
- [x] Adicionar navegação no Dashboard para as novas páginas
- [x] Implementar busca e filtro nas tabelas
- [x] Implementar ordenação nas colunas
- [x] Adicionar estatísticas nas páginas de dados

## Fase 2: CRUD Completo (CONCLUIDA)
- [x] Criar endpoints UPDATE no backend
- [x] Criar endpoints DELETE no backend
- [x] Criar endpoints getById no backend
- [x] Implementar EditCustomerModal no frontend
- [x] Implementar ConfirmDeleteModal reutilizavel
- [x] Integrar edicao e exclusao na CustomersPage
- [x] Atualizar DataTable com acoes de edicao/exclusao
- [x] Testes passando (5/5)

## Fase 3: Finanças (CONCLUIDA)
- [x] Criar schema de charges/cobranças
- [x] Criar endpoints CRUD de charges (create, list, getById, update, delete)
- [x] Criar endpoints de estatísticas (stats, revenueByMonth)
- [x] Implementar página de Finanças com tabela de charges
- [x] Adicionar gráficos de receita com Recharts (BarChart, PieChart)
- [x] Criar CreateChargeModal
- [x] Criar EditChargeModal
- [x] Integrar rota /finances no App.tsx
- [x] Adicionar link de finanças no menu do Dashboard

## Fase 4: Pessoas (CONCLUIDA)
- [x] Criar schema de pessoas/colaboradores com roles (admin, manager, collaborator, viewer)
- [x] Criar endpoints CRUD de pessoas (create, list, getById, update, delete)
- [x] Criar endpoints de estatísticas (stats, roleDistribution, departmentDistribution)
- [x] Implementar página de Pessoas com tabela e gráficos
- [x] Criar CreatePersonModal
- [x] Criar EditPersonModal
- [x] Integrar rota /people no App.tsx
- [x] Adicionar link de Pessoas no menu do Dashboard
- [x] Implementar controle de acesso por função (role-based access control)
- [x] Todos os 5 testes continuam passando

## Fase 5: Governança (CONCLUIDA)
- [x] Criar schema de governança com riskScore, riskLevel, complianceStatus
- [x] Criar endpoints CRUD de governança (create, list, getById, update, delete)
- [x] Implementar autoScore com análise inteligente de risco
- [x] Criar endpoints de estatísticas (riskSummary, riskDistribution, complianceDistribution)
- [x] Implementar página de Governança com:
  - 4 cards de resumo (Score Médio, Críticos, Altos, Conformes)
  - Gráfico de pizza de distribuição de risco
  - Gráfico de pizza de distribuição de conformidade
  - Tabela completa com busca e filtro
  - Seção de alertas de risco
- [x] Integrar rota /governance no App.tsx
- [x] Adicionar link de Governança no menu do Dashboard
- [x] Todos os 5 testes continuam passando

## Fase 6: Dashboard Executivo (CONCLUIDA)
- [x] Criar router de dashboard com endpoints de KPIs
- [x] Implementar endpoints de tendências de receita (12 meses)
- [x] Implementar endpoints de distribuição de agendamentos
- [x] Implementar endpoints de distribuição de cobranças
- [x] Implementar endpoints de métricas de performance
- [x] Criar página ExecutiveDashboard com:
  - 5 cards de KPIs principais (Clientes, Agendamentos, Ordens, Receita, Risco)
  - Gráfico de linha (LineChart) de tendência de receita
  - Gráfico de pizza (PieChart) de distribuição de agendamentos
  - Gráfico de pizza (PieChart) de distribuição de cobranças
  - Seção de métricas de performance com barras de progresso
  - Seção de análise de receita com breakdown
- [x] Integrar rota /executive-dashboard no App.tsx
- [x] Atualizar menu do Dashboard para apontar para dashboard executivo
- [x] Todos os 5 testes continuam passando

## Fase 7: Paginação (CONCLUIDA)
- [x] Criar componente Pagination reutilizável
- [x] Adicionar suporte de paginação no backend (page, limit)
- [x] Integrar paginação em CustomersPage
- [x] Integrar paginação em AppointmentsPage
- [x] Integrar paginação em ServiceOrdersPage
- [x] Integrar paginação em FinancesPage
- [x] Todos os 5 testes continuam passando

## Fase 8: Rastreamento de Contatos e Endereço
- [ ] Expandir schema de customers com campos de endereço (rua, número, complemento, CEP, cidade, estado)
- [ ] Criar tabela de contact_history para rastreamento de contatos
- [ ] Criar endpoints para listar histórico de contatos
- [ ] Atualizar CreateCustomerModal com campos de endereço
- [ ] Atualizar EditCustomerModal com campos de endereço
- [ ] Criar componente de histórico de contatos na página de clientes

## Fase 9: Funções do Nexo Agent (WhatsApp)
- [ ] Verificar endpoints de WhatsApp disponíveis no backend
- [ ] Implementar envio de mensagens via WhatsApp
- [ ] Implementar templates de mensagens
- [ ] Criar interface para enviar mensagens aos clientes
- [ ] Integrar notificações de mensagens recebidas

## Fase 10: Correção de Bugs
- [ ] Corrigir erro de carregamento ao sair do perfil
- [ ] Investigar logs de erro
- [ ] Testar fluxo completo de navegação

## Próximas Melhorias
- [ ] Email verification and password recovery
- [ ] Real-time notifications system
- [ ] Export data to PDF/Excel
- [ ] User profile management
- [ ] Organization settings and customization
- [ ] Audit logs for all operations
- [ ] API rate limiting and security

## Database Schema Status
- [x] organizations table
- [x] accounts table
- [x] customers table
- [x] appointments table
- [x] service_orders table
- [ ] charges table
- [ ] payments table
- [ ] people table
- [ ] risk_snapshots table

## Testing Status
- [x] CRUD operations tests (customers, appointments, service orders)
- [ ] Modal component tests
- [ ] Form validation tests
- [ ] Authentication flow tests
- [ ] Integration tests for dashboard


## Fase 11: Integração com WhatsApp Business API (CONCLUIDA)
- [x] Configurar credenciais da WhatsApp Business API
- [x] Criar endpoint para receber webhooks do WhatsApp
- [x] Implementar validação de webhooks
- [x] Sincronizar mensagens recebidas com banco de dados
- [x] Implementar envio de mensagens via API do WhatsApp
- [x] Adicionar rastreamento de status de entrega
- [x] Implementar WebSocket para atualizações em tempo real
- [x] Criar interface de configuração de credenciais
- [x] Testes de integração com WhatsApp
- [x] Documentação de setup da API


## Fase 12: Implementação de Nota Fiscal (CRÍTICO)
- [ ] Criar tabela `invoices` no banco de dados
- [ ] Criar routers de invoice (create, list, getById, update, delete, generatePDF)
- [ ] Criar página de Nota Fiscal no frontend
- [ ] Implementar modal de emissão de NF
- [ ] Implementar download de PDF da NF
- [ ] Integrar com charges (vincular NF a cobrança)

## Fase 13: Controle de Receita Diária (CRÍTICO)
- [ ] Criar router `finance.dailyRevenue` (agrupa charges por data)
- [ ] Criar página de Relatório Diário no frontend
- [ ] Implementar tabela com data, total recebido, total pendente, total vencido
- [ ] Implementar filtro por período
- [ ] Implementar exportar para CSV/PDF

## Fase 14: Controle de Receita Mensal (CRÍTICO)
- [ ] Criar router `finance.monthlyReport` (receita vs despesa por mês)
- [ ] Criar página de Relatório Mensal no frontend
- [ ] Implementar gráfico de receita vs despesa
- [ ] Implementar tabela com mês, receita, despesa, lucro
- [ ] Implementar filtro por período

## Fase 15: Controle de Despesas (IMPORTANTE)
- [ ] Criar tabela `expenses` no banco de dados
- [ ] Criar routers de expenses (create, list, getById, update, delete)
- [ ] Criar página de Despesas no frontend
- [ ] Implementar CRUD de despesas
- [ ] Implementar categorias de despesas
- [ ] Integrar com relatório mensal (receita vs despesa)

## Fase 16: Integração ServiceOrder → Charge (IMPORTANTE)
- [ ] Adicionar campo `value` em serviceOrders
- [ ] Criar opção de gerar cobrança ao criar ServiceOrder
- [ ] Criar opção de gerar cobrança ao finalizar ServiceOrder
- [ ] Implementar no frontend

## Fase 17: Gráficos de Receita (IMPORTANTE)
- [ ] Implementar gráfico de receita por mês
- [ ] Implementar gráfico de receita vs despesa
- [ ] Implementar gráfico de status de cobranças (pie chart)
- [ ] Adicionar ao dashboard

## Fase 18: Alertas de Cobranças Vencidas (IMPORTANTE)
- [ ] Criar badge vermelha no menu com contagem de vencidas
- [ ] Criar notificação na página de finances
- [ ] Implementar email automático (opcional)

## Fase 19: Categorias de Serviços (OPCIONAL)
- [ ] Criar tabela `serviceCategories`
- [ ] Criar routers de categories (CRUD)
- [ ] Criar página de categorias no frontend
- [ ] Integrar com serviceOrders

## Fase 20: Relatórios em PDF (OPCIONAL)
- [ ] Implementar geração de relatório de clientes em PDF
- [ ] Implementar geração de relatório de cobranças em PDF
- [ ] Implementar geração de relatório de receita em PDF


## Fase 26: Teste Completo de Funcionalidades (EM PROGRESSO)
- [ ] Testar fluxo de login/cadastro
- [ ] Testar criação de clientes
- [ ] Testar agendamentos
- [ ] Testar ordens de serviço
- [ ] Testar cobranças/financeiro
- [ ] Testar referências
- [ ] Testar recuperação de senha
- [ ] Testar governança
- [ ] Testar notificações
- [ ] Testar responsividade mobile

## Fase 27: Sistema de Pagamento (PLANEJADO)
- [ ] Analisar sistema de pagamento da Manus
- [ ] Criar tabela de planos (free, pro, enterprise)
- [ ] Criar tabela de assinaturas
- [ ] Criar tabela de transações
- [ ] Implementar checkout de planos
- [ ] Integrar Stripe (ou payment gateway)
- [ ] Implementar validação de plano ativo
- [ ] Implementar cancelamento de assinatura
- [ ] Implementar renovação automática

## Fase 28: Funcionalidades Faltantes (PLANEJADO)
- [ ] Identificar gaps no sistema
- [ ] Priorizar implementações
- [ ] Planejar roadmap

## 🎨 Fase 29: UX/UI Improvements (10 items) ✅ COMPLETA
- [x] Implementar onboarding com tour interativo (useOnboarding + OnboardingTooltip)
- [x] Adicionar confirmação em ações destrutivas (ConfirmDialog)
- [x] Melhorar feedback visual (NotificationCenter com 4 tipos)
- [x] Criar empty states para todas as páginas (EmptyState component)
- [x] Implementar dark mode com ThemeProvider (useTheme hook)
- [x] Adicionar breadcrumbs em todas as páginas (Breadcrumbs existente)
- [x] Criar loading states granulares (SkeletonLoader)
- [x] Implementar atalhos de teclado (useKeyboardShortcuts + SearchCommand)
- [x] Melhorar responsividade de tabelas em mobile (CSS overflow-x hidden)
- [x] Adicionar busca e filtros avançados (SearchCommand com Cmd+K)

## 🔄 Fase 30: Fluxos e Sequências (5 items)
- [ ] Refatorar fluxo de onboarding (tour → org → cliente → agendamento)
- [ ] Melhorar fluxo de agendamento (disponibilidade → confirmação → SMS)
- [ ] Implementar fluxo de cobrança automática
- [ ] Criar fluxo de governança (avaliação → score → relatório)
- [ ] Implementar fluxo de relatórios (período → métricas → PDF → email)

## 📊 Fase 31: Formatos e Padrões (7 items)
- [ ] Padronizar respostas de API (ApiResponse<T>)
- [ ] Padronizar paginação (PaginatedResponse<T>)
- [ ] Padronizar tratamento de erros (ErrorCode enum)
- [ ] Padronizar datas (ISO 8601 backend, pt-BR frontend)
- [ ] Padronizar moeda (centavos backend, reais frontend)
- [ ] Padronizar enums (CustomerStatus, AppointmentStatus, etc)
- [ ] Implementar slugs em URLs

## 🗄️ Fase 32: Arquitetura de Dados (6 items)
- [ ] Adicionar soft delete (deletedAt field)
- [ ] Implementar versionamento de dados (audit tables)
- [ ] Adicionar relacionamentos explícitos (Drizzle relations)
- [ ] Criar índices de performance
- [ ] Adicionar constraints (unique, not null)
- [ ] Implementar denormalização estratégica

## ⚡ Fase 33: Performance Optimization (5 items)
- [ ] Implementar caching em memória com TTL
- [ ] Adicionar lazy loading de dados
- [ ] Configurar compressão gzip
- [ ] Implementar DataLoader para batch queries
- [ ] Implementar cursor-based pagination

## 🔌 Fase 34: Integrações Críticas (5 items)
- [ ] Integrar SendGrid para email real
- [ ] Integrar Twilio para SMS/WhatsApp
- [ ] Integrar Stripe para pagamentos
- [ ] Integrar Google Calendar
- [ ] Integrar Slack para notificações

## ✅ Fase 35: Compliance e Segurança (4 items)
- [ ] Implementar LGPD (direito ao esquecimento)
- [ ] Adicionar consentimento de dados
- [ ] Criar Termos de Serviço
- [ ] Criar Política de Privacidade

## 🏗️ Fase 36: Refatoração de Arquitetura (10 items) ✅ PARCIAL
- [ ] Refatorar frontend com features/ (customers, appointments, etc)
- [ ] Refatorar backend com services/repositories
- [ ] Migrar para TanStack Query
- [x] Implementar React Hook Form + Zod (validations.ts criado)
- [x] Criar notificação manager centralizado (notificationStore.ts)
- [x] Criar modal manager centralizado (modalStore.ts)
- [x] Implementar RBAC com can() helper (rbac.ts criado)
- [x] Implementar logger estruturado (logger.ts backend + frontend)
- [ ] Criar rotas com metadados
- [x] Implementar error boundary global (ErrorBoundary existente)

## 📈 Módulos Específicos - Customers
- [ ] Importar clientes em bulk (CSV)
- [ ] Exportar clientes (CSV, PDF)
- [ ] Duplicar cliente
- [ ] Mesclar clientes duplicados
- [ ] Histórico de alterações
- [ ] Notas privadas por cliente
- [ ] Tags/categorias
- [ ] Scoring de valor (LTV)

## 📅 Módulos Específicos - Appointments
- [ ] Calendário visual (drag & drop)
- [ ] Disponibilidade por serviço
- [ ] Confirmação automática
- [ ] Lembretes automáticos (SMS, email, WhatsApp)
- [ ] Cancelamento automático se não confirmado
- [ ] Rescheduling fácil
- [ ] Buffer time entre agendamentos
- [ ] Bloqueios de horário

## 💰 Módulos Específicos - Finance
- [ ] Cobrança automática (Stripe, PIX, boleto)
- [ ] Planos de pagamento
- [ ] Desconto por pagamento antecipado
- [ ] Juros por atraso
- [ ] Relatório de fluxo de caixa
- [ ] Previsão de receita
- [ ] Conciliação bancária
- [ ] Nota fiscal eletrônica

## 🎯 Módulos Específicos - Governance
- [ ] Dashboard de riscos
- [ ] Alertas de risco em tempo real
- [ ] Plano de ação automático
- [ ] Acompanhamento de ações corretivas
- [ ] Relatório de conformidade
- [ ] Histórico de avaliações
- [ ] Benchmarking com outras orgs
- [ ] Previsão de risco
