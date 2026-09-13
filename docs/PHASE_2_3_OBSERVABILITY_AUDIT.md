# Fase 2.3 — auditoria de telemetria e degradação operacional

**Data da auditoria:** 2026-09-13  
**Escopo:** estado do repositório após a Fase 2.2; nenhuma inferência de saúde de negócio foi adicionada.  
**Regra:** este documento descreve fatos observáveis. `ready`, disponibilidade de dependência,
contagens e falhas não substituem `operationalState`, risco, governança ou prioridade oficiais.

## Vocabulário de classificação

- **REAL E EXPONÍVEL:** a fonte real existe e há contrato de leitura apropriado.
- **REAL MAS NÃO EXPOSTA:** o fato é produzido/persistido, mas não há superfície operacional suficiente.
- **PARCIAL:** existe parte da coleta, correlação, retenção, teste ou exposição.
- **DUPLICADA:** a superfície deriva decisão/prioridade já pertencente a outra autoridade.
- **MOCK/DEV ONLY:** somente simulação ou ferramenta de desenvolvimento.
- **AUSENTE:** não foi encontrada implementação no repositório.

## Mapa auditado

| # | Capacidade | Classificação | Evidência e limite observado |
|---|---|---|---|
| 1 | Health checks | **PARCIAL** | `GET /health` é deliberadamente superficial e sempre informa o processo como `ok`; detalhes por organização só confirmam a existência do tenant. A verificação real de infraestrutura está em readiness, não no health superficial. |
| 2 | Readiness / liveness | **REAL E EXPONÍVEL** | `/health/readiness` executa `SELECT 1`, verifica o cliente Prisma e consulta BullMQ/Redis, respondendo 503 quando um crítico falha. `/health/liveness` mede apenas processo/uptime. Stripe, Google, e-mail e WhatsApp são declarados opcionais. |
| 3 | Redis / queues | **REAL E EXPONÍVEL** | `QueueService` observa conexão real, falha enqueue sem job falso, tenta recuperar e expõe contagens. Os acumuladores são somente em memória e reiniciam com o processo. |
| 4 | PostgreSQL | **PARCIAL** | Readiness mede disponibilidade e latência instantânea; instrumentação `pg` existe quando OTEL é habilitado. Não há contrato próprio de pool, saturação, erros ou série histórica no exporter interno. |
| 5 | BullMQ waiting/active/delayed/failed/DLQ/stalled | **PARCIAL** | `waiting`, `active`, `completed`, `failed` e `delayed` vêm de `getJobCounts`; DLQs têm filas reais e resumo. Não há contador/sinal exposto de `stalled`. O exporter interno materializa gauges apenas para waiting/failed/active, portanto delayed coletado na consulta não é exportado. |
| 6 | WhatsApp | **PARCIAL** | Há contadores em memória para queued, failure, retry, inbound webhook e dead-letter; DLQ e replay reais; diagnósticos tenant-scoped detectam `QUEUED`/`SENDING` antigos. Readiness de provedor comprova configuração, não disponibilidade runtime. Enqueue failure genérico existe no `QueueObservabilityService`, mas não é unido ao snapshot WhatsApp. |
| 7 | Webhooks genéricos / outbox | **PARCIAL** | Entregas possuem retry/replay e filas webhook/DLQ. A outbox PostgreSQL tem claim, lease, retry e falha definitiva testados, porém não há backlog/oldest-age/failed expostos no resumo operacional. |
| 8 | Financeiro degradado | **REAL MAS NÃO EXPOSTA** | `MetricsService` registra estados factuais de operação financeira (`failed`, `degraded`, `retry_scheduled`, etc.), mas esse snapshot não participa de `/internal/metrics` nem do resumo operacional. Não criar nova classificação: expor os estados já emitidos. |
| 9 | Notification Pub/Sub | **REAL MAS NÃO EXPOSTA** | O transporte mantém readiness factual de publisher/subscriber/subscription, retorna `published`, `no-subscribers`, `timeout`, `unavailable` e preserva PostgreSQL para replay. Esses diagnósticos não aparecem em readiness nem no cockpit. |
| 10 | Stripe / Billing desabilitado ou degradado | **PARCIAL** | Ausência de configuração é exposta em readiness e operações falham de forma estruturada; falhas runtime de API Stripe não alimentam telemetria operacional agregada. O modo simulado é condicionado à configuração de ambiente e não é sinal real. |
| 11 | Auth integrations opcionais | **PARCIAL** | Google OAuth e Resend expõem configuração/ausência; envio de verificação distingue `sent`, `failed` e `provider_unavailable`. Não há probe runtime nem métrica agregada das falhas do provedor. |
| 12 | Operational monitoring | **REAL E EXPONÍVEL** | Endpoints administrativos de summary, queues, DLQ e recovery existem e são consumidos pelo cockpit. O resumo mistura fatos com a regra local `waiting > 25`; essa regra não é uma autoridade oficial e deve ser retirada ou substituída por política existente antes de ser tratada como alerta. |
| 13 | Operational incidents | **DUPLICADA** | Incidentes são reconstruídos a cada leitura a partir de razões do health, filas e retries; não têm ciclo de vida/ack/retention e duplicam algumas razões (health + queue). Servem como projeção efêmera, não como autoridade de incidente. |
| 14 | Internal stats | **PARCIAL** | `/internal/stats` é corretamente tenant-scoped e não vaza infraestrutura global. `/internal/metrics` expõe apenas métricas de queue em memória e não consolida `MetricsService`, WhatsApp, PostgreSQL ou Pub/Sub. |
| 15 | Logs estruturados | **PARCIAL** | Requests terminados emitem JSON com rota, status, latência e IDs. Vários serviços ainda usam mensagens textuais do `Logger`; não há logger estruturado uniforme. Alguns logs de bootstrap incluem configuração não secreta; payloads/tokens não devem ser incorporados. |
| 16 | requestId / correlationId / traceId | **PARCIAL** | Middleware gera/saneia request e correlation IDs, devolve headers e inclui trace ativo; jobs preservam request/correlation IDs. `traceId` não é propagado explicitamente nos payloads genéricos de BullMQ, embora o fluxo WhatsApp tenha campo próprio. |
| 17 | Métricas existentes | **PARCIAL** | Existem três stores distintos em memória (`MetricsService`, queue e WhatsApp), mais OTEL/Prometheus opcional. Nomes atuais são estáveis no código, mas o exporter não os consolida, não há persistência e instâncias múltiplas não são agregadas fora do OTEL. Labels de tenant não foram introduzidas. |
| 18 | Dashboard / Cockpit | **PARCIAL** | Cockpit consome summary/incidents e filtra fatos (`backlog > 0`, `failed > 0`) para apresentação. Dashboard executivo consome sinais operacionais tenant-scoped. A API `OperationalSignalsService` contém `priorityScore` próprio: é legado de decisão, não telemetria da Fase 2.3, e não deve ser copiado para o modelo factual. |

## Contrato factual mínimo recomendado

Não criar um novo `operationalState`. Consolidar uma **amostra** com instante e componentes,
sem score, severidade ou prioridade:

```ts
type DependencyObservation = {
  component: 'database' | 'redis' | 'queue' | 'whatsapp_provider' |
    'billing' | 'notification_transport'
  availability: 'available' | 'unavailable' | 'not_configured' | 'unknown'
  observedAt: string
  latencyMs?: number
  facts?: {
    waiting?: number
    active?: number
    delayed?: number
    failed?: number
    stalled?: number
    dlqBacklog?: number
    processingFailures?: number
  }
}
```

Regras do contrato:

1. `availability` relata probe/configuração; `unknown` é obrigatório quando não houve probe.
2. Contagens vêm diretamente de BullMQ ou persistência; ausência de coleta não vira zero.
3. `not_configured` só é válido para integração opcional.
4. Nenhum `orgId`/`userId` vira label de métrica global.
5. Superfície tenant-scoped deve filtrar no backend pelo `orgId` autenticado.
6. O consumidor decide apenas apresentação; não calcula risco, prioridade ou score.
7. Threshold/alerta só pode apontar para uma política de governança já versionada. Sem política,
   exponha apenas a contagem factual.

## Gaps priorizados

### A — falhas críticas invisíveis

1. Notification Pub/Sub já conhece seu estado, mas ele não é exposto.
2. Outbox não expõe backlog, falhas definitivas nem idade do item mais antigo.
3. Não existe sinal runtime de disponibilidade do provider WhatsApp.
4. `stalled` BullMQ não é coletado/exposto.
5. Falhas runtime Stripe e de auth providers ficam restritas a erro/log.

### B — fatos já coletados e não expostos

1. `delayed` é consultado, mas não entra no exporter de queue.
2. Estados financeiros e métricas HTTP do `MetricsService` não entram no exporter.
3. Snapshot WhatsApp não entra em `/internal/metrics`.
4. Readiness do Pub/Sub não entra na superfície operacional.

### C — correlação e retenção

1. Propagar `traceId` nos jobs quando houver span ativo e restaurar contexto no worker.
2. Migrar logs de falha críticos para envelope JSON comum, com request/correlation/trace e org
   somente quando necessário, sem payload, token, headers de autenticação ou secrets.
3. Contadores em memória perdem continuidade em restart e divergem entre réplicas; OTEL deve
   ser o caminho de agregação, não um quarto store manual.

### D — semântica de health

1. Documentar `/health` como health superficial de processo, nunca como readiness.
2. Manter `/health/liveness` sem dependências externas para evitar restart storm.
3. Manter `/health/readiness` fail-closed para PostgreSQL e Redis/queue críticos.
4. Separar indisponibilidade da dependência de backlog/falha histórica: job `failed` retido não
   significa que Redis está indisponível.

### E — cobertura de degradação

- Coberto agora por teste unitário: PostgreSQL down, Redis/queue down e recuperação.
- Já coberto: enqueue não retorna job simulado quando Redis falha; retry de conexão.
- Pendente: integração real derrubando/recuperando Redis e PostgreSQL; stalled real; Pub/Sub;
  DLQ > 0 em contrato; isolamento tenant de stale SENDING e webhook/outbox stats.

## Plano objetivo

### Fase 2.3A — contrato e visibilidade crítica

- Publicar o contrato factual versionado, reutilizando os serviços atuais.
- Unir readiness de PostgreSQL, Redis e Notification Pub/Sub sem criar score.
- Expor delayed/stalled/DLQ e outbox backlog/failed/oldest age como fatos.
- Expor configuração versus probe runtime separadamente para WhatsApp e Billing.
- Remover do resumo factual o threshold local `waiting > 25` e qualquer derivação de prioridade.

### Fase 2.3B — correlação e exportação

- Consolidar métricas já emitidas no exporter OTEL/Prometheus.
- Padronizar nomes e envelope de logs; propagar `traceId` nos limites async.
- Definir retenção/agregação externa; manter labels globais de baixa cardinalidade.

### Fase 2.3C — recuperação comprovada

- Testes reais de queda e recovery de Redis/PostgreSQL.
- Exercitar DLQ, stalled, replay de webhook/outbox e stale SENDING por tenant.
- Runbooks com comandos, critérios de sucesso e rollback.

### Fase 2.3D — consumo operacional

- Somente após os contratos: adaptar Cockpit para exibir fatos e `unknown` sem fabricar zero.
- Manter decisões, risco, prioridade e `operationalState` exclusivamente nas autoridades atuais.

## Riscos residuais

- O status agregado atual do cockpit pode ficar degradado por jobs falhos retidos e pelo threshold
  local, mesmo com dependências disponíveis.
- Métricas em memória reiniciam e não representam todas as réplicas.
- `/internal/operations/*` entrega fatos globais a um papel `ADMIN` de organização; antes de
  produção multi-tenant, deve existir papel/plano de autorização de operador da plataforma ou
  uma projeção estritamente tenant-scoped.
- O health detalhado por tenant não diagnostica infraestrutura por desenho; operadores devem usar
  readiness/telemetria de plataforma.
- A instrumentação OTEL é opcional e sua disponibilidade/exportação não é atualmente observada.
