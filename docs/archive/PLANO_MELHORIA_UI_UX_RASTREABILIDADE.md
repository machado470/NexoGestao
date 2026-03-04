# Plano de Melhoria: UI/UX e Rastreabilidade de Colaboradores

## 1. MELHORIAS DE UI/UX IMEDIATAS

### 1.1 Design System
**Implementar:**
- Paleta de cores consistente (primária: #F97316, secundária: #0EA5E9)
- Ícones para cada status (usando Lucide React)
- Componentes reutilizáveis (Card, Badge, Alert, etc)
- Animações suaves (transições, hover effects)
- Tipografia consistente (headings, body, labels)

### 1.2 Dashboard
**Melhorias:**
- Aumentar tamanho dos cards de KPI
- Adicionar ícones descritivos em cada card
- Adicionar cores de fundo diferentes por KPI
- Adicionar animação de contagem (0 → valor real)
- Adicionar card de "Risco" (5º KPI)
- Adicionar seção de "Alertas" (cobranças vencidas, agendamentos próximos)
- Adicionar "Quick Actions" (botões para criar cliente, agendamento, etc)

### 1.3 Clientes
**Melhorias:**
- Mudar tabela para card view em mobile
- Adicionar cores para status (ativo/inativo)
- Adicionar ícones de ação (editar, deletar, histórico)
- Adicionar badge de "Agendamentos pendentes"
- Adicionar badge de "Ordens pendentes"
- Adicionar busca avançada (por email, telefone, etc)
- Adicionar filtro por status
- Mostrar endereço completo em tooltip
- Mostrar número WhatsApp com ícone

### 1.4 Agendamentos
**Melhorias:**
- Adicionar visualização de calendário (Month/Week/Day view)
- Adicionar cores para status (scheduled, confirmed, done, canceled, no_show)
- Adicionar ícones de status
- Adicionar indicador visual de urgência (próximo, vencido)
- Adicionar campo de "Colaborador responsável"
- Adicionar notificação de agendamento próximo
- Adicionar drag-and-drop para reagendar
- Adicionar integração com WhatsApp (enviar lembrete)

### 1.5 Ordens de Serviço
**Melhorias:**
- Adicionar cores para prioridade (low, medium, high, urgent)
- Adicionar ícones de prioridade
- Adicionar timeline de progresso (open → assigned → in_progress → done)
- Adicionar campo de "Valor/Preço" (CRÍTICO)
- Adicionar campo de "Tempo estimado"
- Adicionar campo de "Tempo gasto"
- Adicionar integração com colaboradores (mostrar quem está fazendo)
- Adicionar histórico de mudanças de status
- Adicionar botão para gerar cobrança

### 1.6 Financeiro
**Melhorias:**
- Adicionar botão de criar cobrança
- Adicionar botão de editar cobrança
- Adicionar botão de marcar como paga
- Adicionar filtro por status
- Adicionar busca por cliente
- Adicionar cores para status (pending, paid, overdue, canceled)
- Adicionar ícones de status
- Adicionar indicador visual de urgência (vencido)
- Adicionar seção de "Relatório diário"
- Adicionar seção de "Relatório mensal"
- Adicionar gráfico de receita vs despesa

### 1.7 Pessoas
**Melhorias:**
- Adicionar cores para role (admin, manager, collaborator, viewer)
- Adicionar ícones de role
- Adicionar indicador visual de status (ativo, inativo, suspenso)
- Adicionar campo de "Valor/Hora"
- Adicionar seção de "Ganhos totais"
- Adicionar seção de "Ordens atribuídas"
- Adicionar seção de "Histórico de descontos"
- Adicionar gráfico de ganhos por mês
- Adicionar relatório de performance (quantas ordens completou, tempo médio)

### 1.8 WhatsApp
**Melhorias:**
- Adicionar integração com dados do cliente
- Adicionar templates de mensagens
- Adicionar histórico de conversas por data
- Adicionar indicador de status de entrega
- Adicionar timestamp de mensagens
- Adicionar indicador de "digitando"
- Adicionar integração com histórico de contatos

---

## 2. RASTREABILIDADE DE COLABORADORES (CRÍTICO)

### 2.1 Tabelas Necessárias

**Tabela: serviceTracking**
```sql
CREATE TABLE serviceTracking (
  id INT PRIMARY KEY AUTO_INCREMENT,
  organizationId INT NOT NULL,
  serviceOrderId INT NOT NULL,
  collaboratorId INT NOT NULL,
  startTime DATETIME NOT NULL,
  endTime DATETIME,
  status ENUM('started', 'paused', 'completed', 'canceled') DEFAULT 'started',
  hoursWorked DECIMAL(10, 2),
  hourlyRate DECIMAL(10, 2),
  amountEarned DECIMAL(10, 2),
  notes TEXT,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (organizationId) REFERENCES organizations(id),
  FOREIGN KEY (serviceOrderId) REFERENCES serviceOrders(id),
  FOREIGN KEY (collaboratorId) REFERENCES people(id)
);
```

**Tabela: discounts**
```sql
CREATE TABLE discounts (
  id INT PRIMARY KEY AUTO_INCREMENT,
  organizationId INT NOT NULL,
  serviceTrackingId INT NOT NULL,
  reason VARCHAR(255) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  percentage DECIMAL(5, 2),
  approvedBy INT,
  notes TEXT,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organizationId) REFERENCES organizations(id),
  FOREIGN KEY (serviceTrackingId) REFERENCES serviceTracking(id),
  FOREIGN KEY (approvedBy) REFERENCES people(id)
);
```

### 2.2 Routers Necessários

**Router: serviceTracking**
```typescript
serviceTracking: router({
  create: protectedProcedure
    .input(z.object({
      serviceOrderId: z.number(),
      collaboratorId: z.number(),
      startTime: z.date(),
      hourlyRate: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Criar registro de rastreamento
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    // Listar rastreamentos da organização
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      // Obter rastreamento
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      endTime: z.date().optional(),
      status: z.enum(['started', 'paused', 'completed', 'canceled']).optional(),
    }))
    .mutation(async ({ input }) => {
      // Atualizar rastreamento e calcular amountEarned
    }),

  getByCollaborator: protectedProcedure
    .input(z.object({ collaboratorId: z.number() }))
    .query(async ({ input }) => {
      // Listar rastreamentos de um colaborador
    }),

  getByServiceOrder: protectedProcedure
    .input(z.object({ serviceOrderId: z.number() }))
    .query(async ({ input }) => {
      // Listar rastreamentos de uma ordem
    }),

  calculateEarnings: protectedProcedure
    .input(z.object({
      collaboratorId: z.number(),
      startDate: z.date(),
      endDate: z.date(),
    }))
    .query(async ({ input }) => {
      // Calcular ganhos totais do colaborador no período
    }),
});
```

**Router: discounts**
```typescript
discounts: router({
  create: protectedProcedure
    .input(z.object({
      serviceTrackingId: z.number(),
      reason: z.string(),
      amount: z.number().optional(),
      percentage: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Criar desconto e atualizar amountEarned em serviceTracking
    }),

  list: protectedProcedure
    .input(z.object({ serviceTrackingId: z.number() }))
    .query(async ({ input }) => {
      // Listar descontos de um rastreamento
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      // Deletar desconto e recalcular amountEarned
    }),
});
```

### 2.3 Páginas Frontend Necessárias

**Página 1: Rastreamento de Serviços**
- Tabela com todos os serviços rastreados
- Colunas: Ordem, Colaborador, Data, Tempo, Valor, Status, Ações
- Filtro por colaborador, data, status
- Botão para visualizar detalhes
- Botão para adicionar desconto
- Botão para finalizar rastreamento

**Página 2: Ganhos de Colaborador**
- Tabela com todos os ganhos do colaborador
- Colunas: Data, Ordem, Tempo, Valor, Descontos, Total
- Gráfico de ganhos por mês
- Seção de descontos (motivo, valor)
- Total acumulado

**Integração em ServiceOrders**
- Ao criar ordem, atribuir a colaborador
- Ao atribuir, iniciar rastreamento automático
- Ao finalizar ordem, finalizar rastreamento
- Mostrar histórico de rastreamento
- Botão para adicionar desconto

**Integração em Pessoas**
- Mostrar ganhos totais do colaborador
- Mostrar ordens atribuídas
- Mostrar histórico de descontos
- Gráfico de ganhos por mês

---

## 3. INTEGRAÇÕES CRÍTICAS

### 3.1 ServiceOrder → Charge
Quando finalizar uma ordem de serviço:
1. Calcular valor total (baseado em serviceTracking)
2. Criar charge automaticamente
3. Vincular charge à ordem
4. Notificar cliente

### 3.2 ServiceTracking → Charge
Quando finalizar rastreamento:
1. Calcular valor a receber do colaborador
2. Criar charge para pagamento do colaborador
3. Vincular charge ao rastreamento

### 3.3 Charge → Invoice
Quando marcar cobrança como paga:
1. Gerar nota fiscal
2. Enviar PDF para cliente
3. Atualizar status da cobrança

### 3.4 Agendamento → WhatsApp
Quando agendamento estiver próximo (24h antes):
1. Enviar mensagem de lembrete via WhatsApp
2. Incluir dados do agendamento
3. Incluir link para confirmar/cancelar

### 3.5 Cobrança Vencida → Notificação
Quando cobrança vencer:
1. Enviar notificação ao usuário
2. Enviar email ao cliente
3. Enviar mensagem WhatsApp ao cliente

---

## 4. COISAS QUE PASSARAM DESPERCEBIDO

### 4.1 Auditoria
- Adicionar campos: `createdBy`, `updatedBy` em todas as tabelas
- Criar tabela de `auditLog` para registrar todas as ações

### 4.2 Validações
- Validar email (RFC 5322)
- Validar telefone (formato brasileiro)
- Validar CPF/CNPJ
- Validar data (não permitir datas futuras para cobranças pagas)

### 4.3 Permissões
- Implementar RBAC (Role-Based Access Control)
- Restringir visualização de dados por role
- Restringir edição/exclusão por role

### 4.4 Notificações
- Implementar sistema de notificações em tempo real
- Adicionar badges de contagem (agendamentos próximos, cobranças vencidas)
- Adicionar toasts de sucesso/erro

### 4.5 Relatórios
- Implementar geração de PDF
- Implementar exportação para CSV/Excel
- Implementar relatórios agendados (enviar por email)

### 4.6 Performance
- Implementar cache de dados
- Implementar lazy loading
- Implementar paginação em todas as listas
- Implementar busca otimizada

### 4.7 Segurança
- Implementar validação de entrada (XSS, SQL injection)
- Implementar rate limiting
- Implementar CORS
- Implementar HTTPS

---

## 5. ROADMAP DE IMPLEMENTAÇÃO

### SEMANA 1: Rastreabilidade (CRÍTICO)
- [ ] Criar tabelas: serviceTracking, discounts
- [ ] Criar routers: serviceTracking.*, discounts.*
- [ ] Criar página de rastreamento
- [ ] Integrar com ServiceOrders

### SEMANA 2: UI/UX Dashboard
- [ ] Melhorar design dos cards
- [ ] Adicionar ícones e cores
- [ ] Adicionar seção de alertas
- [ ] Adicionar quick actions

### SEMANA 3: UI/UX Clientes e Agendamentos
- [ ] Melhorar tabela de clientes
- [ ] Adicionar visualização de calendário
- [ ] Adicionar cores e ícones de status
- [ ] Adicionar indicadores visuais

### SEMANA 4: UI/UX Ordens e Financeiro
- [ ] Adicionar campo de valor em ordens
- [ ] Adicionar CRUD de charges
- [ ] Adicionar relatório diário/mensal
- [ ] Adicionar gráficos de receita

### SEMANA 5: Integrações
- [ ] ServiceOrder → Charge
- [ ] ServiceTracking → Charge
- [ ] Charge → Invoice
- [ ] Agendamento → WhatsApp
- [ ] Cobrança vencida → Notificação

### SEMANA 6: Funcionalidades Adicionais
- [ ] Auditoria
- [ ] Validações
- [ ] Permissões
- [ ] Notificações
- [ ] Relatórios

---

## 6. RESUMO

**Rastreabilidade:** 0% → 100% (implementar tabelas, routers, páginas)
**UI/UX:** 40% → 80% (melhorar design, adicionar cores, ícones, indicadores)
**Integrações:** 30% → 90% (implementar fluxos críticos)
**Funcionalidades:** 50% → 90% (adicionar CRUD, relatórios, validações)

**Impacto:** Transformar de um sistema básico para um ERP profissional com rastreabilidade completa.

