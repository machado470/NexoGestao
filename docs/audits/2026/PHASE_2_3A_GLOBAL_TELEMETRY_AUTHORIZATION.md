# Fase 2.3A — fronteira de autorização da telemetria global

## Autoridade encontrada

O modelo persistido de usuário possui somente `ADMIN`, `MANAGER`, `STAFF` e
`VIEWER`. `OPERADOR` e `FINANCEIRO` são aliases funcionais normalizados pelos
guards atuais; nenhum deles representa autoridade de plataforma. Os guards
`JwtAuthGuard`, `ActiveUserGuard`, `RolesGuard` e `AdminGuard` autenticam e
autorizam usuários vinculados a uma organização, sem estabelecer uma identidade
global.

Não existe hoje operador de plataforma, super admin, credencial service-to-service,
allowlist operacional ou guard administrativo global com semântica implementada.
`BOOTSTRAP_SECRET` é exclusivamente a proteção do fluxo de bootstrap do primeiro
administrador e, portanto, não é uma credencial operacional.

## Consumidores auditados

O BFF `apps/web/server/routers/operational.ts` consumia `summary`, `incidents`,
`queues` e `dlq` com a sessão normal do usuário. O Cockpit Operacional consome
`summary` e `incidents` por esse BFF. Não há consumidor encontrado para
`recent-failures`; esse endpoint combinava o `orgId` da sessão com incidentes e
métricas globais. A documentação arquitetural também registra os quatro primeiros
endpoints como contrato do Cockpit.

## Classificação do contrato anterior

| Campo/fonte | Escopo | Exposição a tenant ADMIN |
| --- | --- | --- |
| `status`, `degradedReasons`, `healthTimeline` | GLOBAL DE PLATAFORMA | NÃO DEVE SER EXPOSTO |
| `metrics.retries`, `failedJobs`, `failedWebhooks` | GLOBAL DE PLATAFORMA | NÃO DEVE SER EXPOSTO |
| `queues` e seus contadores BullMQ | GLOBAL DE PLATAFORMA | NÃO DEVE SER EXPOSTO |
| `dlq` e seus contadores | GLOBAL DE PLATAFORMA | NÃO DEVE SER EXPOSTO |
| `incidents` e respectivos `metadata` | GLOBAL DE PLATAFORMA | NÃO DEVE SER EXPOSTO |
| `recoveryActions` | GLOBAL DE PLATAFORMA | NÃO DEVE SER EXPOSTO |
| `factual.contractVersion` e `observedAt` | Metadados do snapshot GLOBAL DE PLATAFORMA | NÃO DEVE SER EXPOSTO nessa superfície |
| PostgreSQL, Redis, BullMQ, Pub/Sub e Outbox em `factual.dependencies` | GLOBAL DE PLATAFORMA | NÃO DEVE SER EXPOSTO |
| readiness/configuração de WhatsApp provider e Billing | GLOBAL DE PLATAFORMA | NÃO DEVE SER EXPOSTO |
| `recent-failures.orgId` | TENANT-SCOPED, mas apenas um rótulo da sessão | SEGURO isoladamente, porém removido para não rotular fatos globais como tenant |

Nenhum fato retornado anteriormente por esses cinco endpoints era consultado por
`orgId`; portanto, não há dado operacional dessa composição que possa permanecer
tenant-facing com segurança. Leituras e ações realmente tenant-scoped continuam
em suas superfícies próprias, que derivam o tenant da identidade autenticada.

## Decisão mínima

Os cinco endpoints permanecem autenticados e preservam a restrição de role, mas
negam também o `ADMIN` de organização antes de consultar qualquer fonte global.
O serviço factual e seu `contractVersion = 2` permanecem internos, sem score,
severity ou priority, preparados para uma futura superfície respaldada por uma
decisão arquitetural explícita de autoridade de plataforma.

O BFF e o Cockpit continuam sem receber fatos globais: as queries atuais passam a
receber `403`. Isso causa estado de erro explícito no Cockpit em vez de apresentar
listas vazias como se a plataforma estivesse saudável. Uma futura evolução deve
ou criar uma autoridade de plataforma real e uma superfície separada, ou substituir
o Cockpit tenant-facing por fontes genuinamente filtradas pelo `orgId` autenticado.

## Riscos residuais

- O BFF ainda declara procedures para o contrato global e propagará o `403`; isso
  preserva compatibilidade estrutural, mas o Cockpit não terá telemetria até haver
  um contrato tenant-scoped ou uma autoridade de plataforma.
- Outros endpoints de health/stats não fazem parte destes cinco contratos e devem
  manter auditorias próprias de escopo.
- O snapshot interno continua agregado globalmente; ele não deve ser conectado a
  uma rota tenant-facing sem uma nova revisão de autorização.
