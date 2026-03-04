# Plano de Integração: Backend Prisma + Frontend tRPC

## 📊 Análise Comparativa

### Backend Prisma (apps/api/)
- **Framework:** NestJS
- **ORM:** Prisma
- **Database:** PostgreSQL
- **Módulos:** 27 (Admin, Appointments, Assessments, Assignments, Audit, Auth, Bootstrap, Customers, Finance, Governance, People, Reports, Risk, Service Orders, Tracks, WhatsApp, etc.)
- **Modelos:** 21 (Organization, User, Person, Track, Assessment, CorrectiveAction, Customer, Appointment, ServiceOrder, Charge, Payment, WhatsAppMessage, etc.)
- **Status:** ✅ Funcional, Multi-tenant, Completo

### Frontend tRPC (client/)
- **Framework:** React 19
- **RPC:** tRPC 11
- **ORM:** Drizzle (MySQL)
- **Páginas:** 24
- **Status:** ✅ Funcional, Moderno, Type-safe

---

## 🎯 Estratégia de Integração

### Opção A: Substituir Drizzle por Prisma (Recomendado)
**Vantagens:**
- ✅ Usa o backend Prisma que você criou
- ✅ Reutiliza 27 módulos NestJS
- ✅ Mantém PostgreSQL (mais robusto que MySQL)
- ✅ Aproveita toda a lógica de negócio existente

**Desvantagens:**
- ❌ Precisa refatorar tRPC routers
- ❌ Mudar database de MySQL para PostgreSQL
- ❌ Integrar NestJS com Express tRPC

**Esforço:** 16-20 horas

---

### Opção B: Manter Drizzle + Integrar Lógica Prisma (Alternativa)
**Vantagens:**
- ✅ Mantém estrutura atual (tRPC + Drizzle)
- ✅ Menos refatoração
- ✅ Continua com MySQL

**Desvantagens:**
- ❌ Duplica código de negócio
- ❌ Não aproveita módulos Prisma
- ❌ Mais complexo de manter

**Esforço:** 20-24 horas

---

## 🏗️ Arquitetura Proposta (Opção A)

```
Frontend (React 19 + tRPC)
    ↓
tRPC Routers (Express)
    ↓
Prisma Client
    ↓
PostgreSQL Database
```

### Estrutura de Diretórios

```
NexoGestao/
├── client/                    (Frontend React)
├── server/                    (tRPC + Express)
│   ├── routers/
│   │   ├── admin.ts
│   │   ├── appointments.ts
│   │   ├── assessments.ts
│   │   ├── assignments.ts
│   │   ├── audit.ts
│   │   ├── auth.ts
│   │   ├── customers.ts
│   │   ├── finance.ts
│   │   ├── governance.ts
│   │   ├── people.ts
│   │   ├── reports.ts
│   │   ├── risk.ts
│   │   ├── service-orders.ts
│   │   ├── tracks.ts
│   │   └── whatsapp.ts
│   ├── services/              (Lógica de negócio)
│   │   ├── admin.service.ts
│   │   ├── appointments.service.ts
│   │   ├── ... (cópia dos services do Prisma)
│   ├── _core/                 (Infraestrutura)
│   │   ├── prisma.ts          (Prisma Client)
│   │   ├── trpc.ts
│   │   └── ...
│   └── index.ts
├── apps/api/                  (Backend Prisma - REFERÊNCIA)
│   └── src/
│       ├── admin/
│       ├── appointments/
│       ├── ... (27 módulos)
│       └── prisma/
└── prisma/                    (Schema PostgreSQL)
    ├── schema.prisma
    └── migrations/
```

---

## 📋 Passos de Implementação

### Fase 1: Preparação (2-3h)
- [ ] Criar banco PostgreSQL
- [ ] Copiar schema Prisma
- [ ] Instalar Prisma Client em server/
- [ ] Criar arquivo .env com DATABASE_URL PostgreSQL

### Fase 2: Migração de Serviços (6-8h)
- [ ] Copiar services do apps/api/src para server/services/
- [ ] Refatorar imports (NestJS → Express)
- [ ] Adaptar injeção de dependência
- [ ] Testar cada serviço

### Fase 3: Criar Routers tRPC (6-8h)
- [ ] Criar 15 routers tRPC (um para cada módulo)
- [ ] Integrar com services
- [ ] Adicionar validação com Zod
- [ ] Testar cada router

### Fase 4: Conectar Frontend (2-3h)
- [ ] Atualizar client/ para usar novos routers
- [ ] Testar fluxos completos
- [ ] Validar multi-tenant

### Fase 5: Limpeza e Deploy (1-2h)
- [ ] Remover apps/ (código legado)
- [ ] Atualizar documentação
- [ ] Fazer commit final

---

## 🔄 Mapeamento de Módulos

| Módulo Prisma | Serviço | Router tRPC | Status |
|---|---|---|---|
| admin | AdminOverviewService | admin | ⏳ TODO |
| appointments | AppointmentsService | appointments | ⏳ TODO |
| assessments | AssessmentsService | assessments | ⏳ TODO |
| assignments | AssignmentsService | assignments | ⏳ TODO |
| audit | AuditService | audit | ⏳ TODO |
| auth | AuthService | auth | ⏳ TODO |
| customers | CustomersService | customers | ✅ EXISTE |
| finance | FinanceService | finance | ✅ EXISTE |
| governance | GovernanceService | governance | ✅ EXISTE |
| people | PeopleService | people | ✅ EXISTE |
| reports | ReportsService | reports | ⏳ TODO |
| risk | RiskService | risk | ⏳ TODO |
| service-orders | ServiceOrdersService | service-orders | ✅ EXISTE |
| tracks | TracksService | tracks | ⏳ TODO |
| whatsapp | WhatsAppService | whatsapp | ⏳ TODO |

---

## 🗄️ Modelos Prisma → Drizzle

| Modelo Prisma | Tabela Drizzle | Status |
|---|---|---|
| Organization | organizations | ✅ EXISTE |
| User | users | ✅ EXISTE |
| Person | people | ✅ EXISTE |
| Customer | customers | ✅ EXISTE |
| Appointment | appointments | ✅ EXISTE |
| ServiceOrder | service_orders | ✅ EXISTE |
| Charge | charges | ✅ EXISTE |
| Payment | payments | ⏳ TODO |
| Track | tracks | ⏳ TODO |
| TrackItem | track_items | ⏳ TODO |
| Assessment | assessments | ⏳ TODO |
| CorrectiveAction | corrective_actions | ⏳ TODO |
| RiskSnapshot | risk_snapshots | ⏳ TODO |
| GovernanceRun | governance_runs | ⏳ TODO |
| WhatsAppMessage | whatsapp_messages | ⏳ TODO |
| AuditEvent | audit_events | ⏳ TODO |
| TimelineEvent | timeline_events | ⏳ TODO |

---

## 🚀 Recomendação Final

**Implementar Opção A (Substituir Drizzle por Prisma):**

1. **Vantagens:**
   - Aproveita 100% do backend que você criou
   - Mantém toda a lógica de negócio
   - Mais robusto (PostgreSQL)
   - Escalável para futuro

2. **Desvantagens:**
   - Mais trabalho inicial
   - Precisa migrar database

3. **Timeline:**
   - Semana 1: Preparação + Migração de serviços
   - Semana 2: Criar routers tRPC
   - Semana 3: Conectar frontend + Testes
   - Semana 4: Deploy + Documentação

---

## 📝 Próximos Passos

Quer que eu:
1. **Implemente a Opção A** (Integração completa com Prisma)
2. **Implemente a Opção B** (Manter Drizzle + Integrar lógica)
3. **Crie um plano customizado** (Sua preferência)

Qual você prefere?
