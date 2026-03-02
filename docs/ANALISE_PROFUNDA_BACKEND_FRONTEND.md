# Análise Profunda: Backend vs Frontend - NexoGestão

## 1. CAPACIDADES DO BACKEND

### ✅ Tabelas de Banco de Dados (12 tabelas)
1. **users** - Usuários Manus OAuth
2. **organizations** - Organizações (email/senha)
3. **accounts** - Contas/Assinaturas
4. **customers** - Clientes (com endereço completo)
5. **appointments** - Agendamentos
6. **serviceOrders** - Ordens de Serviço
7. **charges** - Cobranças/Faturas (com status: PENDING, PAID, OVERDUE, CANCELED)
8. **people** - Colaboradores/Pessoas
9. **governance** - Governança/Risco
10. **contactHistory** - Histórico de Contatos
11. **whatsappMessages** - Mensagens WhatsApp
12. **FALTAM: invoices, expenses, revenue, dailyReport**

### ✅ Routers Backend (9 routers)
1. **auth** - Login, registro, logout
2. **data** - Customers, Appointments, ServiceOrders (CRUD completo)
3. **finance** - Charges (CRUD + stats + revenueByMonth)
4. **people** - Pessoas/Colaboradores (CRUD + stats)
5. **governance** - Governança (CRUD + riskSummary)
6. **dashboard** - KPIs, métricas, distribuições
7. **contact** - Histórico de contatos
8. **whatsapp-webhook** - Mensagens WhatsApp
9. **nexo-proxy** - API proxy para NexoAgent

### ✅ Funcionalidades de Finance
- Criar/listar/atualizar/deletar cobranças
- Rastreamento de status (PENDING, PAID, OVERDUE, CANCELED)
- Cálculo de totais por status
- Receita por mês (revenueByMonth)
- Estatísticas (totalCharges, totalPending, totalPaid, etc)

### ❌ FALTAM NO BACKEND
1. **Nota Fiscal (Invoice)**
   - Tabela: invoices (id, organizationId, customerId, chargeId, invoiceNumber, issueDate, dueDate, amount, status, pdfUrl)
   - Routers: create, list, getById, update, delete, generatePDF

2. **Controle de Despesas (Expenses)**
   - Tabela: expenses (id, organizationId, description, amount, category, date, status)
   - Routers: create, list, getById, update, delete

3. **Receita Diária (Daily Revenue)**
   - Função: dailyRevenue query (agrupa charges por data)
   - Retorna: [{ date, totalReceived, totalPending, totalOverdue }]

4. **Relatório de Receita/Despesa**
   - Função: monthlyReport query (receita vs despesa por mês)
   - Retorna: [{ month, revenue, expenses, profit }]

5. **Categorias de Serviços**
   - Tabela: serviceCategories (id, organizationId, name, basePrice)
   - Relacionamento com serviceOrders

---

## 2. O QUE ESTÁ IMPLEMENTADO NO FRONTEND

### ✅ Páginas Funcionais (com backend integrado)
1. **Login/Register** - Autenticação completa ✅
2. **Dashboard** - Visão geral (KPIs) ✅
3. **Customers** - CRUD completo ✅
4. **Appointments** - CRUD completo ✅
5. **Service Orders** - CRUD completo ✅
6. **Finances** - Visualização de cobranças ✅
7. **People** - CRUD de colaboradores ✅
8. **Governance** - Visualização de risco ✅
9. **WhatsApp** - Interface de chat ✅

### ⚠️ Páginas APENAS VISUAIS (sem backend real)
1. **FinancesPage** - Mostra dados de charges, mas:
   - ❌ Não tem interface para criar/editar cobranças
   - ❌ Não tem relatório diário de receita
   - ❌ Não tem relatório mensal
   - ❌ Não tem emissão de nota fiscal
   - ❌ Não tem controle de despesas

2. **Dashboard** - Mostra KPIs, mas:
   - ❌ Não tem gráficos de receita vs despesa
   - ❌ Não tem projeção de receita
   - ❌ Não tem alertas de cobranças vencidas

3. **ServiceOrders** - CRUD básico, mas:
   - ❌ Não tem campo de valor/preço
   - ❌ Não tem integração com charges
   - ❌ Não tem gerar cobrança automática

---

## 3. FUNCIONALIDADES APENAS VISUAIS (NÃO FUNCIONAIS)

### ❌ FinancesPage
```
Problemas encontrados:
1. Tabela de cobranças mostra dados, mas:
   - Não há botão de criar cobrança
   - Não há botão de editar cobrança
   - Não há botão de marcar como paga
   
2. Não há seção de:
   - Relatório diário de receita
   - Relatório mensal de receita
   - Controle de despesas
   - Emissão de nota fiscal
   - Gráficos de receita vs despesa
```

### ❌ Dashboard
```
Problemas encontrados:
1. Cards de KPI mostram valores hardcoded (0)
2. Não há gráficos de receita
3. Não há alertas de cobranças vencidas
4. Não há projeção de receita
```

### ❌ ServiceOrders
```
Problemas encontrados:
1. Não há campo de valor/preço na criação
2. Não há integração com charges (não gera cobrança automática)
3. Não há botão para gerar cobrança manualmente
```

---

## 4. TUDO QUE ESTÁ FALTANDO

### CRÍTICO (Impacta negócio)
1. **Emissão de Nota Fiscal**
   - Tabela: invoices
   - Routers: create, list, generatePDF
   - Frontend: Modal para emitir NF, visualizar, baixar PDF

2. **Controle de Receita Diária**
   - Router: finance.dailyRevenue (agrupa por data)
   - Frontend: Tabela com data, total recebido, total pendente, total vencido

3. **Controle de Receita Mensal**
   - Router: finance.monthlyReport (receita vs despesa)
   - Frontend: Gráfico e tabela com receita, despesa, lucro por mês

4. **Controle de Despesas**
   - Tabela: expenses
   - Routers: create, list, update, delete
   - Frontend: Página de despesas com CRUD

5. **Integração ServiceOrder → Charge**
   - Quando criar ServiceOrder, opção de gerar cobrança automática
   - Campo de valor/preço em ServiceOrder

### IMPORTANTE (Melhora UX)
1. **Gráficos de Receita**
   - Gráfico de receita por mês
   - Gráfico de receita vs despesa
   - Gráfico de status de cobranças (pie chart)

2. **Alertas de Cobranças Vencidas**
   - Badge vermelha no menu
   - Notificação na página de finances
   - Email automático

3. **Categorias de Serviços**
   - Tabela: serviceCategories
   - Routers: CRUD
   - Frontend: Página de categorias

4. **Relatórios em PDF**
   - Relatório de clientes
   - Relatório de cobranças
   - Relatório de receita

### OPCIONAL (Futuro)
1. **Integração com Stripe/PagSeguro**
   - Receber pagamentos online
   - Sincronizar com charges

2. **Agendamento de Lembretes**
   - Lembrete de cobrança vencida
   - Lembrete de agendamento

3. **Integração com Contabilidade**
   - Exportar para contabilista
   - Sincronizar com sistema contábil

---

## 5. FUNCIONALIDADES QUE NÃO ESTÃO FUNCIONANDO

### FinancesPage
- ❌ Não carrega dados de charges corretamente
- ❌ Não há botão de criar cobrança
- ❌ Não há botão de editar cobrança
- ❌ Não há botão de marcar como paga
- ❌ Não há filtro por status
- ❌ Não há busca por cliente

### Dashboard
- ❌ KPIs mostram 0 (não estão calculando)
- ❌ Gráficos não existem
- ❌ Não há dados reais de receita

### ServiceOrders
- ❌ Não há campo de valor/preço
- ❌ Não há integração com charges
- ❌ Não há botão para gerar cobrança

---

## 6. RECOMENDAÇÕES DE IMPLEMENTAÇÃO

### FASE 1 (Crítico - 1 semana)
1. Criar tabela `invoices` no banco
2. Criar routers de invoice (create, list, generatePDF)
3. Criar interface de emissão de NF no frontend
4. Criar router `finance.dailyRevenue`
5. Criar página de relatório diário

### FASE 2 (Importante - 1 semana)
1. Criar tabela `expenses`
2. Criar routers de expenses (CRUD)
3. Criar página de despesas no frontend
4. Criar router `finance.monthlyReport`
5. Criar gráficos de receita vs despesa

### FASE 3 (Melhorias - 2 semanas)
1. Adicionar campo de valor em ServiceOrder
2. Integrar ServiceOrder → Charge (gerar cobrança automática)
3. Criar tabela `serviceCategories`
4. Implementar alertas de cobranças vencidas
5. Implementar gráficos no dashboard

---

## 7. RESUMO EXECUTIVO

**Backend:** 70% completo (faltam invoices, expenses, dailyRevenue, monthlyReport)
**Frontend:** 50% completo (muitas páginas são apenas visuais, sem funcionalidade real)
**Integração:** 60% completa (faltam as funcionalidades críticas de finance)

**Prioridade:** Implementar invoices, expenses, e relatórios de receita/despesa ASAP.

