---
status: CLOSED
owner: nexogestao
last_reviewed: 2026-09-13
closed_at: 2026-09-13
source_of_truth: false
scope: phase-2.3d
baseline: main-after-pr-1010
---

# Fase 2.3D — Cockpit operacional tenant-scoped

> **Status final: CLOSED.** A Fase 2.3D foi encerrada em **2026-09-13**, na baseline `main`
> após o PR #1010 (merge `f6ac68233433d61ba9ff2aecfe5d667fba9a76e2`). Este documento preserva
> abaixo o desenho auditado na Onda 1 e registra, ao final, as evidências de implementação e
> fechamento das Ondas 2 e 3.

## 1. Decisão executiva

Esta seção registra a primeira onda, que foi **auditoria e desenho**, não implementação da UI. A baseline inspecionada foi o
merge `608b807f` (PR #1007). As Fases 2.3A, 2.3B e 2.3C permanecem fechadas; esta proposta não
altera recovery, Redis, stalled, governança ou risco.

**Decisão:** não existe hoje um contrato único adequado ao Cockpit de uma organização. Criar
`GET /v1/operations/tenant-summary`, servido pela API NestJS, e expô-lo no BFF como
`operations.tenantSummary`, sem input. O endpoint recebe o tenant exclusivamente de
`req.user.orgId`; query, body e headers enviados pelo navegador não são autoridade de tenant.

Os contratos `GET /internal/operations/{summary,incidents,queues,dlq,recent-failures}` continuam
reservados e retornando `403` inclusive para `ADMIN` de organização. Eles não serão chamados pelo
Cockpit tenant. Não será criado alias, fallback ou tradução desses dados globais.

## 2. Estado atual auditado

### 2.1 Página, BFF e API

| Camada | Implementação atual | Resultado observado |
|---|---|---|
| Página | `apps/web/client/src/pages/OperationalCockpitPage.tsx` | Faz duas queries, `operations.summary` e `operations.incidents`; exibe status geral, incidentes, filas e DLQ. Usa `AppPageShell`, `AppOperationalHeader`, `AppSectionBlock`, `AppStatusBadge`, cards e estados canônicos de página. |
| Seletores no browser | `getCriticalIncidents`, `getDegradedQueues` e filtro de DLQ | Filtram severidade/degradação já recebidas, mas a tela ainda monta frases positivas como “Sem críticos”, “Sem degradação” e empty states a partir de arrays. Como o upstream hoje responde `403`, esses campos ficam indisponíveis. No contrato futuro, ausência/erro não poderá virar normalidade. |
| BFF | `apps/web/server/routers/operational.ts` | `summary`, `incidents`, `queues` e `dlq` têm Zod de output explícito, não recebem input e fazem pass-through para `/internal/operations/*`. O schema de summary ainda aceita campos extras com `.passthrough()`. |
| Transporte | `apps/web/server/_core/nexoTransport.ts` e `nexoClient.ts` | Encaminha o bearer token da sessão e normaliza o envelope, mas o helper retorna `any`; a garantia efetiva de output é a `.output(...)` da procedure. Não deve acrescentar `orgId`. |
| API global | `apps/api/src/health/operations.controller.ts` | Todos os cinco endpoints lançam `ForbiddenException` antes de consultar monitoring/incidents. A proteção é correta e deve permanecer byte-for-byte equivalente. |
| Prova global | `apps/api/src/health/operations.controller.spec.ts` | Prova `401` sem autenticação, `403` por roles não ADMIN, `403` para ADMIN das orgs A/B, tentativa de spoof por query/header e ausência de leitura dos serviços globais. |

### 2.2 Schemas Zod atuais

O router atual declara:

- `operationsSummary`: `status: ok|degraded`, razões, métricas globais de retry/falha, filas,
  DLQ e recovery actions;
- `incident[]`: severidade `INFO|WARNING|CRITICAL`, código, descrição, fonte e instante;
- `queueStatus[]`: contagens BullMQ e classificação `degraded` vinda da API;
- `dlqStatus[]`: backlog/falhas por fila global;
- nenhuma das quatro procedures aceita `orgId`.

Esses schemas descrevem telemetria de plataforma e **não devem ser reaproveitados** no novo
contrato. Além disso, o router contém procedures de ações operacionais e webhook deliveries; elas
não são consumidas pela página atual e não fazem parte desta onda.

### 2.3 Fontes globais que permanecem fechadas

`OperationalMonitoringService` observa PostgreSQL, Redis/BullMQ, Pub/Sub, outbox, readiness do
provider WhatsApp, configuração global de Stripe, métricas em memória, DLQ e ações de recovery.
`OperationalIncidentsService` projeta incidentes a partir dessas fontes. Nenhuma consulta recebe
`orgId`; portanto nenhum campo produzido por esses serviços pode atravessar o contrato tenant.

Permanecem globais: status geral da plataforma, PostgreSQL/Redis, todas as contagens de filas e
DLQ, stalled, outbox global, workers, Pub/Sub, OTEL/métricas em memória, configuração de provider
do processo, incidentes derivados e diagnósticos/recovery internos.

### 2.4 Fontes oficiais tenant-scoped já disponíveis

- `DashboardService.getExecutivePipeline(orgId)` consulta Customer, Appointment, ServiceOrder,
  Charge e Payment sempre com `orgId` e já preserva a indisponibilidade de decisão agregada.
- `WebhookService.listEndpoints(orgId)` filtra `WebhookEndpoint.orgId`; deliveries filtram por
  `endpoint.orgId`. São fatos persistidos de configuração/entrega, não prova de disponibilidade do
  transporte.
- `BillingService.getSubscription/getBillingStatus(orgId)` e o controller de Billing retiram
  `orgId` do JWT. Assinatura e seu status persistido são fatos do tenant; configuração Stripe do
  processo é global e fica excluída.
- `OrganizationSettingsService.getAdministrativeSummary(orgId)` filtra organização, usuários e
  execution config. É útil como evidência de configuração, mas não é um substituto do contrato:
  contém seções administrativas e `recommendedAction`, que não pertencem ao Cockpit factual.
- WhatsApp conversations/messages são filtradas por `orgId`; mensagens `FAILED` podem ser
  contadas como fato do tenant. Não há, porém, uma configuração/readiness de provider por tenant.
  Logo “WhatsApp disponível” não pode ser afirmado nesta onda.

## 3. Matriz de autoridade

| Campo/fato | Fonte atual | Escopo real | Autoridade | Pode expor ao tenant? | Ação 2.3D |
|---|---|---|---|---|---|
| `status` geral `ok/degraded` | monitoring summary | global | API/monitoring de plataforma | **Não** | Remover do Cockpit tenant; não criar equivalente agregado. |
| incidentes e `severity` | incidents service sobre monitoring | global e efêmero | API de plataforma | **Não** | Não expor nem reconstruir no BFF/browser. |
| queue waiting/active/failed/delayed | BullMQ `getQueueStatus` | global | infraestrutura/API | **Não** | Manter somente em `/internal/operations/*`. |
| queue `degraded`/razões | monitoring | global | API de plataforma | **Não** | Não copiar, recalcular ou substituir por threshold. |
| DLQ backlog/falhas | filas DLQ + métricas globais | global | infraestrutura/API | **Não** | Manter fechado; não filtrar por payload de job no Cockpit. |
| retries/falhas WhatsApp | metrics store em memória | global/processo | API de plataforma | **Não** | Excluir. |
| PostgreSQL/Redis/PubSub/outbox/workers/OTEL | factual snapshot e diagnósticos | global | API de plataforma | **Não** | Excluir integralmente. |
| readiness/configuração do provider WhatsApp | env do processo | global | API de plataforma | **Não** | Excluir; apresentar status tenant `unknown` enquanto não existir fonte própria. |
| mensagens WhatsApp falhas | `WhatsAppMessage where {orgId,status:FAILED}` | tenant | API + persistência | **Sim, como contagem factual** | Incluir `facts.failedMessages`; não converter em health/severity. |
| configuração WhatsApp do tenant | nenhuma fonte identificada | inexistente | — | **Não ainda** | `status: unknown`, `reasonCode: TENANT_CONFIGURATION_NOT_OBSERVABLE`; nunca `available`. |
| endpoints webhook total/ativos | `WebhookEndpoint where {orgId}` | tenant | API + persistência | **Sim** | `not_configured` se nenhum endpoint; se existe, `unknown` para disponibilidade e contagens factuais. |
| deliveries PENDING/SUCCESS/FAILED | `WebhookDelivery.endpoint.orgId` | tenant | API + persistência | **Sim** | Incluir contagens por status; não classificar risco/prioridade. |
| assinatura/status de billing | `Subscription where {orgId}` | tenant | Billing API + persistência | **Sim** | `not_configured` sem assinatura; caso exista, `unknown` para disponibilidade e `subscriptionStatus` factual. |
| Stripe configurado/readiness | env/cliente Stripe do processo | global | API de plataforma | **Não** | Excluir. |
| execution config | `Organization.executionConfig` por id do tenant | tenant | API + persistência | **Sim** | `available` quando registro factual existe, senão `not_configured`; expor somente modo e `updatedAt`. |
| volumes Customer/Appointment/O.S./Charge/Payment | pipeline executivo com filtros `orgId` | tenant | API + persistência | **Sim** | Reutilizar consulta/contrato factual; estado operacional continua `unknown`, nunca inferido do volume. |
| risco, prioridade, health, severity, nextAction | autoridades de domínio/governança | tenant, conforme domínio | API de domínio | **Não neste contrato** | Não selecionar, agregar nem derivar. |

## 4. Contrato proposto

### 4.1 Endpoint e procedure

- REST: `GET /v1/operations/tenant-summary`.
- Autorização: `JwtAuthGuard`, `ActiveUserGuard` e roles explicitamente acordadas para a página;
  o método chama `service.getSummary(req.user.orgId)`.
- Request: sem DTO de query/body e sem `orgId`. Qualquer `?orgId=...` não participa da consulta;
  o teste deve provar que não muda o resultado. Headers de organização também são ignorados.
- BFF: `operations.tenantSummary`, `protectedProcedure`, sem `.input()`, com `.output()` estrito e
  chamada autenticada ao endpoint acima.
- Envelope: a API pode usar o envelope HTTP canônico; o BFF desembrulha transporte e entrega
  exatamente o payload validado. Não adiciona defaults nem traduz status.

### 4.2 Shape inicial

```ts
type TenantFactStatus =
  | 'available'
  | 'unavailable'
  | 'not_configured'
  | 'unknown'

type TenantOperationalFact = {
  key: 'resources' | 'whatsapp' | 'webhooks' | 'billing' | 'operation_config'
  status: TenantFactStatus
  observedAt: string
  reasonCode: string | null
  facts: Record<string, string | number | boolean | null>
}

type TenantOperationsSummary = {
  contractVersion: 1
  generatedAt: string
  facts: TenantOperationalFact[]
}
```

O schema Zod deve substituir o `Record` ilustrativo por união discriminada estrita por `key`, com
campos factuais nomeados:

- `resources`: volumes e timestamps já retornados pelo executive pipeline; `status: available`
  somente se a leitura oficial concluiu, ou `unknown` se a API deliberadamente capturar falha;
- `whatsapp`: `failedMessages`; `status: unknown` até existir configuração/probe tenant-scoped;
- `webhooks`: `configuredEndpoints`, `activeEndpoints`, `pendingDeliveries`,
  `successfulDeliveries`, `failedDeliveries`; zero endpoints implica `not_configured`, endpoint
  persistido implica `unknown`, não `available`;
- `billing`: `subscriptionStatus`; ausência implica `not_configured`, assinatura persistida implica
  `unknown` quanto à disponibilidade do provider;
- `operation_config`: `executionMode` e `updatedAt`; registro presente implica `available` para a
  **configuração**, não para a saúde da operação; ausência implica `not_configured`.

`unavailable` só pode ser emitido por falha factual observada da fonte tenant-scoped. Falha não
classificada ou ausência de probe é `unknown`. Campo não coletado é `null`/omitido conforme schema,
nunca zero. A API não inclui `orgId` na resposta: isolamento é uma propriedade da consulta, não um
valor que o cliente deva escolher ou usar para autorização.

## 5. Testes de isolamento e contrato esperados

### API

1. Criar orgs A/B com volumes, mensagens, endpoints/deliveries, subscription e execution config
   distintos; token A retorna apenas os fatos A e token B apenas os fatos B.
2. Repetir a leitura A com `?orgId=B`, body GET e `x-org-id: B`; resposta permanece A (ou `400` se
   a política global rejeitar query desconhecida), nunca B.
3. Provar que o novo service não injeta `OperationalMonitoringService`, `QueueService`, métricas
   globais ou leitura sem filtro tenant.
4. Manter a suíte de `OperationsController`: ADMIN A/B continua `403` em todos os cinco endpoints
   globais e nenhuma fonte global é consultada.
5. Fixtures sem configuração preservam `not_configured`; ausência de probe/fonte preserva
   `unknown`; exceção observada não é convertida em `available`.
6. Resposta nunca contém segredos de webhook, URLs se não forem necessárias, payloads de entrega,
   credenciais, DSNs, nomes de queue ou identificadores de outro tenant.

### BFF

1. `operations.tenantSummary` não possui input e chama somente
   `/v1/operations/tenant-summary` com bearer da sessão.
2. Output Zod é uma união explícita e fechada, normaliza apenas o envelope e preserva literalmente
   `available|unavailable|not_configured|unknown`.
3. Payload inválido (status desconhecido, `key`/facts incompatíveis, campo obrigatório ausente ou
   fato global extra) causa erro de output; não há fallback local.
4. Teste-fonte impede `orgId`, chamadas a `/internal/operations/` e cálculo por threshold/sort no
   novo caminho.

### Frontend (onda posterior, somente após aprovação deste contrato)

1. Renderizar cada fato retornado e os estados `unknown`, `unavailable` e `not_configured` com
   rótulos explícitos “Não disponível”, “Indisponível” e “Não configurado”.
2. Erro/ausência não produz “saudável”, “disponível”, “sem incidentes”, “sem críticos” ou zero.
3. Nenhum `Date.now`, threshold, score, sort de prioridade, severidade, health ou `nextAction` é
   introduzido no browser.
4. A página usa somente `operations.tenantSummary` e mantém a fundação canônica solicitada.

## 6. Lista exata de arquivos da implementação proposta

Nenhum destes arquivos de produção é alterado nesta primeira onda. Após aprovação do contrato, o
menor pacote previsto é:

1. `apps/api/src/health/tenant-operations.types.ts` — tipos/união discriminada do contrato.
2. `apps/api/src/health/tenant-operations.service.ts` — composição factual filtrada pelo `orgId`
   autenticado; sem dependência do monitoring global.
3. `apps/api/src/health/tenant-operations.controller.ts` — `GET /v1/operations/tenant-summary`.
4. `apps/api/src/health/tenant-operations.service.spec.ts` — status canônicos, fontes e filtros.
5. `apps/api/src/health/tenant-operations.controller.spec.ts` — auth, spoof e isolamento A/B.
6. `apps/api/src/health/health.module.ts` — registrar apenas controller/service novos.
7. `apps/api/test/integration/tenant-operations-summary-postgres.integration.spec.ts` — prova real
   cross-tenant sobre as tabelas selecionadas.
8. `apps/web/server/routers/operational.ts` — schema Zod estrito e procedure `tenantSummary`; as
   procedures globais podem permanecer para futura autoridade de plataforma, mas sem consumidor
   tenant.
9. `apps/web/server/routers/operational-cockpit.contract.test.ts` — output inválido, envelope,
   ausência de input/cálculo e endpoint correto.
10. `apps/web/client/src/pages/OperationalCockpitPage.tsx` — em onda posterior, trocar as duas
    queries globais pela summary tenant e somente apresentar seus estados/fatos.
11. `apps/web/client/src/pages/OperationalCockpitPage.test.ts` — render de todos os estados e
    guardrails contra fabricação.

Não é necessário alterar `apps/api/src/health/operations.controller.ts`; sua proteção é uma
invariante. Se a implementação exigir mudá-lo para “compartilhar” lógica, o desenho deve ser
rejeitado.

## 7. Gates e fora de escopo

Gates antes da UI: aprovação desta matriz e do shape; prova A/B; spoof bloqueado; schemas API/BFF
convergentes; suíte global `403` verde; revisão explícita de cada select Prisma. Só então migrar a
página e remover seus consumidores de summary/incidents globais.

Ficam fora: autoridade de operador de plataforma, reabertura de `/internal/operations/*`, health
global, alertas/incidentes tenant, risco, prioridade, severidade, próxima ação, mudanças de
governança, recovery/Redis/stalled e qualquer trabalho da Fase 2.4.

## 8. Fechamento formal

As três ondas previstas foram concluídas:

| Onda | Escopo | Estado |
|---|---|---|
| 1 | Auditoria e desenho | **CLOSED** |
| 2 | Contrato tenant-scoped API/BFF | **CLOSED** |
| 3 | Migração do Operational Cockpit | **CLOSED** |

A baseline final é `main` após o PR #1010, cujo merge é
`f6ac68233433d61ba9ff2aecfe5d667fba9a76e2`. Este fechamento é exclusivamente documental e não
inicia a Fase 2.4.

### 8.1 Contrato entregue

- REST: `GET /v1/operations/tenant-summary`.
- BFF: `operations.tenantSummary`.
- A única autoridade de tenant é `req.user.orgId`, isto é, o contexto autenticado. Nenhum `orgId`
  vindo do navegador é autoridade.
- Os estados canônicos são `available`, `unavailable`, `not_configured` e `unknown`.
- A resposta contém os cinco fatos discriminados `resources`, `whatsapp`, `webhooks`, `billing` e
  `operation_config`.

O contrato expõe fatos tenant-scoped. Ele não é um motor de saúde operacional e não deriva health,
risco, prioridade ou próxima ação.

### 8.2 Prova de isolamento em PostgreSQL real

Em **2026-09-13**, a prova de integração com PostgreSQL real foi executada com sucesso:

```text
PASS test/integration/tenant-operations-summary-postgres.integration.spec.ts

Test Suites: 1 passed, 1 total
Tests:       1 passed, 1 total
test_exit=0
```

A execução persistiu dados diferentes para duas organizações e validou que a leitura de cada uma
não continha dados da outra. Também provou que o secret do webhook e o payload privado não vazaram
e que `orgId` não foi exposto no payload público.

### 8.3 Proteção global preservada

`/internal/operations/*` permanece reservado à plataforma e um `ADMIN` de organização continua
recebendo `403`. Não foi concedido ao tenant acesso a health global de PostgreSQL ou Redis, filas
globais, DLQ global, workers, Pub/Sub, OTEL, incidentes globais ou readiness global de providers.
`apps/api/src/health/operations.controller.ts` não foi alterado como parte deste fechamento.

### 8.4 Frontend concluído

`OperationalCockpitPage` consome somente
`trpc.operations.tenantSummary.useQuery(undefined)`. O auto-refresh e o refresh manual atuam apenas
sobre `tenantSummary`. A página não consome mais `operations.summary`, `operations.incidents`,
`operations.queues`, `operations.dlq` nem `/internal/operations/*`.

A interface apresenta cinco seções factuais: **Recursos**, **WhatsApp**, **Webhooks**,
**Cobrança** e **Configuração operacional**. Ela não apresenta health agregado, severity, risco,
score, priority, `nextAction`, mensagem fabricada de “sem incidentes” ou normalidade inferida por
ausência. Zero permanece um zero factual; `null` é apresentado como “Não disponível”; `unknown` e
`not_configured` permanecem explícitos.

### 8.5 Evidências da Onda 3

Os gates registrados para a migração final foram:

| Verificação | Resultado |
|---|---|
| `pnpm --filter ./apps/web test` | **PASS** — 75 arquivos, 573 testes |
| `pnpm --filter ./apps/web typecheck` | **PASS** |
| `pnpm --filter ./apps/web build` | **PASS** |
| Vitest específico: `OperationalCockpitPage.test.ts` e `operational-cockpit.contract.test.ts` | **PASS** — 2 arquivos, 31 testes |
| `git diff --check` | **PASS** |

### 8.6 Limites das evidências

O encerramento não reivindica HA ou SLA, health global da plataforma, disponibilidade global do
Stripe ou do provider WhatsApp, recuperação de Pub/Sub, incidentes tenant derivados, nem
risco/prioridade/`nextAction` tenant. Esses temas permanecem fora do escopo. A Fase 2.3D termina
com a apresentação estrita de fatos tenant-scoped; a ausência de um fato não prova normalidade.
