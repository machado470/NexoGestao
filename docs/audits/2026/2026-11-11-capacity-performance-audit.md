# Auditoria de capacidade e desempenho — 11/11/2026

> Atualização: este documento registra o diagnóstico anterior às correções. Veja a [implementação e validação](2026-11-11-capacity-corrections.md). As reproduções da auditoria são asserções da versão-base `d9d1ce07`, destinadas a demonstrar os defeitos anteriores.

## Escopo e limites

Base: `/workspace/NexoGestao`, branch `main`, HEAD `d9d1ce07b19d0d52c2262bf092e6a65c18a3f81d`; `git status --short --branch` inicial limpo e sincronizado. Nenhum AGENTS.md aplicável encontrado. README, manifests e scripts conferidos: PNPM 10.30.3, NestJS/Prisma/PostgreSQL, BFF tRPC/React e BullMQ/Redis.

Esta é uma auditoria de código e comportamento de serviços, não um teste de carga. Não foram medidos RPS, p95/p99, consumo sob concorrência, planos SQL nem capacidade máxima. Nenhuma chamada a produção/provedor, escrita em banco, instalação, migration, reset ou deploy. Foram acrescentados somente este relatório e as evidências; código da aplicação preservado. Sem commit/push nesta rodada.

## Achados em ordem de prioridade

### C01 — Listas e buscas incompletas acima da primeira página — P1, confirmado por código

[Clientes](../../../apps/web/client/src/pages/CustomersPage.tsx:468) solicita `page:1, limit:300`, e sua paginação local fatia apenas os registros recebidos. [O.S.](../../../apps/web/client/src/pages/ServiceOrdersPage.tsx:246) solicita as primeiras 500 ordens e coleções auxiliares; [Agendamentos](../../../apps/web/client/src/pages/AppointmentsPage.tsx:139) parte de 100 registros. Os filtros locais não procuram as páginas seguintes. O [contrato de Clientes no BFF](../../../apps/web/server/routers/customers.ts:218) devolve array e descarta a metadata da paginação da API, dificultando detectar incompletude.

O [WhatsApp](../../../apps/web/client/src/pages/WhatsAppPage.tsx:1803) consulta com filtros vazios, filtra localmente e não consome `nextCursor`, apesar de a [API](../../../apps/api/src/whatsapp/whatsapp-conversation-read.service.ts:24) retornar cursor, com 50 conversas por padrão. Conversas fora da primeira página podem ficar inacessíveis pela busca atual.

Impacto: crescer pode ocultar registros, não apenas deixar a interface lenta. Coleções auxiliares truncadas também não comprovam ausência de vínculo. Correção recomendada: filtros e paginação no servidor, metadata/cursor explícitos, carregamento contextual por ID; manter compatibilidade dos consumidores existentes ao evoluir o contrato. Regressões: registro além de 300/500, busca por item antigo e conversa além da primeira página. Não foi reproduzido no navegador com esse volume nesta auditoria.

### C02 — Resumo da carteira corta em 500 e apresenta quantidade parcial como total — P1, reproduzido

[CustomersOperationalSummaryService](../../../apps/api/src/customers/customers-operational-summary.service.ts:17) usa `MAX_CUSTOMERS=500`; consulta os mais recentes e calcula [totalCustomers](../../../apps/api/src/customers/customers-operational-summary.service.ts:526) a partir dessa amostra. Não há sinal de truncamento no retorno. Clientes antigos, inclusive os com problemas, podem ficar fora da avaliação.

Reprodução de serviço: fonte fictícia com 501 clientes, respeitando `take` da consulta, retornou 500 resumos e `portfolio.totalCustomers=500`. Não é uma medição PostgreSQL. Correção: separar total real de quantidade avaliada, explicitar cobertura e avaliar a carteira inteira em lotes/agregações. Preservar critérios de risco; não corrigir simplesmente removendo o teto.

### C03 — Chat carrega histórico inteiro — P1 antes de volume alto, consulta confirmada

[WhatsAppConversationReadService.getMessages](../../../apps/api/src/whatsapp/whatsapp-conversation-read.service.ts:84) executa `findMany` sem `take` ou cursor. O caminho é utilizado pelo controller `/whatsapp/conversations/:id/messages`, BFF `getMessages` e [página](../../../apps/web/client/src/pages/WhatsAppPage.tsx:2131), que transforma/inverte a coleção completa. O feed paginado por cliente já existente não é esse caminho.

Reprodução confirmou ausência de limite/cursor na consulta. Impacto provável: payload, memória da API e renderização crescem com toda a conversa. Latência e memória ainda não medidas. Correção: feed paginado por conversa, ordenação estável com desempate por ID e carregamento de mensagens anteriores; preservar navegação e disponibilidade do histórico, sem corte silencioso no endpoint antigo.

### C04 — Agendamentos aceita limite sem teto; Calendário consulta sem intervalo — P1 antes de exposição a carga, reproduzido parcialmente

[AppointmentsController](../../../apps/api/src/appointments/appointments.controller.ts:36) recebe `@Query() any`; o [serviço](../../../apps/api/src/appointments/appointments.service.ts:182) converte números sem teto/validação equivalente à de Clientes. O [BFF](../../../apps/web/server/routers/appointments.ts:24) exige inteiro positivo, mas não limita o máximo.

Reprodução: `limit=1000000` chegou ao `take` do repositório. Nenhum milhão de registros foi criado ou consultado. O [Calendário](../../../apps/web/client/src/pages/CalendarPage.tsx:129) solicita 1000, sem `from/to`, apesar de a API suportar período. Assim pode transferir dados fora da janela e omitir eventos após o corte.

Correção: validação e teto coordenados entre API/BFF, datas da janela visível e estratégia para períodos densos. Cobrir valores negativos/fracionários/infinitos, limite máximo e eventos além de 1000. Não adicionar um teto sem revisar o consumidor do Calendário.

### C05 — Resumo operacional materializa históricos extensos — P2, estrutura confirmada; custo a medir

Após buscar até 500 clientes, [getSummary](../../../apps/api/src/customers/customers-operational-summary.service.ts:220) carrega sete conjuntos em paralelo. O.S. e agendamentos desses clientes não têm limite temporal nem `take`; pagamentos e Timeline têm janela, outras consultas restringem estado. O cálculo acontece em memória. Não é N+1 por cliente: há consultas em lote, o que é positivo, mas o volume de linhas continua crescendo.

Correção: agregações/consultas específicas aos sinais necessários e, se medido necessário, resumo persistido com atualização por eventos. Validar equivalência de todos os sinais atuais, principalmente existência de cobrança, datas e histórico. Medir linhas lidas, memória, tempo de CPU e consultas por abertura da página.

### C06 — Cache não reúne cálculos concorrentes — P2, reproduzido

[MemoryCacheService.getOrSet](../../../apps/api/src/common/cache/memory-cache.service.ts:48) consulta o cache, aguarda a função e só então armazena; não guarda a promessa em andamento. O [Dashboard](../../../apps/api/src/dashboard/dashboard.service.ts:78) já tem cache de cinco minutos para métricas e alertas e quinze para gráficos, portanto não recalcula tudo em cada acesso. Porém um cache vazio/invalidado permite cálculos repetidos simultaneamente.

Reprodução: 20 chamadas concorrentes para a mesma chave executaram a função 20 vezes. A rotina de métricas tem quatro lotes com várias contagens/agregações e leitura de Governança. Correção inicial: reunir chamadas em andamento por chave, liberando a entrada também em erro; avaliar jitter/coordenação entre réplicas após medir. Testar isolamento das chaves por organização e novas tentativas após falha.

### C07 — Limitadores por organização são locais ao processo — P2, reproduzido; relevante ao escalar réplicas

[TenantOperationsService](../../../apps/api/src/common/tenant-ops/tenant-ops.service.ts:31) mantém buckets e contadores em Maps locais. Duas instâncias permitem consumo independente para a mesma organização; reiniciar perde o bucket. Não foi encontrado backend compartilhado configurado para o Throttler global na composição examinada. Nginx tem limites por IP, que não equivalem a limite por organização.

Reprodução: limite fictício de dois bloqueou a terceira operação na primeira instância, mas outra instância permitiu operação adicional. Há proteções reais: limites financeiros/mensagens, quotas e reserva transacional em partes do motor de execução; este achado não significa ausência total de controle nem invalida o mecanismo transacional do motor.

Correção: buckets atômicos compartilhados para os controles que precisam valer entre réplicas, política explícita em indisponibilidade do Redis e orçamento por organização. Testar duas instâncias, reinício, pico de um tenant e preservação da latência de outro.

### C08 — Métricas em memória permitem chaves sem limite — P2, reproduzido

[RequestLoggerMiddleware.endpointKey](../../../apps/api/src/common/middleware/request-logger.middleware.ts:11) normaliza UUIDs e números, mas mantém segmentos arbitrários. O [MetricsService](../../../apps/api/src/common/metrics/metrics.service.ts:22) guarda as chaves em Map sem teto/expiração. O middleware é aplicado globalmente. O filtro de exceções também registra erros por caminho.

Reprodução direta da geração/coleta: 1000 caminhos desconhecidos diferentes produziram 1000 chaves retidas. Não foi um ataque HTTP nem medição de heap. Os atributos exportados dos contadores de domínio já restringem cardinalidade; o problema permanece no snapshot local.

Correção: usar templates de rota, categoria fixa para desconhecidas e teto de segurança/expiração. Preservar detalhe da URL nos logs conforme política própria, sem usá-lo como dimensão ilimitada de métricas. Auditar também Maps por tenant para retenção após inatividade.

### C09 — Auditoria agrupa todo o histórico e não tem índice composto para actorPersonId — P2, candidato SQL

[Resumo](../../../apps/api/src/audit/audit-admin.service.ts:109) faz dois `groupBy` e um `count`; sem período, cobre todo o tenant. [Lista](../../../apps/api/src/audit/audit-admin.service.ts:49) filtra `actorPersonId`, mas o [schema](../../../prisma/schema.prisma:397) possui índice em `personId`, campo diferente, e nenhum composto de organização/ator/data. Não foi encontrado índice equivalente nas migrations examinadas.

Não se pode afirmar que o PostgreSQL fará scan completo ou que um novo índice reduzirá latência sem plano real. Próximo passo: `EXPLAIN (ANALYZE, BUFFERS)` das consultas de leitura com distribuições realistas, medindo também escrita e tamanho do índice; avaliar `(orgId, actorPersonId, createdAt)` e paginação profunda. Busca textual `contains` em Clientes também merece plano específico: índices B-tree existentes não comprovam eficiência de busca por substring. Evitar criar índices especulativos.

### C10 — Fila WhatsApp compartilha capacidade entre empresas e tipos de tarefa — P2, configuração confirmada

O [worker](../../../apps/api/src/queue/processors/whatsapp.processor.ts:338) usa a fila `whatsapp`, concorrência 5 e limiter BullMQ de 10 jobs/segundo. Entrada e envio são nomes de tarefas na mesma fila; esse limite não é por organização nem uma promessa de dez mensagens entregues por segundo. Jobs podem falhar, repetir ou aguardar provedor.

Uma empresa com pico pode ocupar a fila e atrasar outras ou o tráfego de entrada. Não foi medido starvation nem atraso de fila. Correção a avaliar: admissão justa por tenant, orçamento por conta/provedor e isolamento de entrada/saída se as medições justificarem. Já existem retries com backoff/jitter, retenção de falhas, DLQ e proteção de idempotência; preservar tudo isso. Medir idade do job mais antigo e tempo até processar, além da quantidade na fila.

## Prontidão para medir capacidade

- Existem OTel/Prometheus opcionais, histogramas de processamento, contadores e métricas de backlog, logs com latência e request/correlation IDs. Não é correto afirmar que não há observabilidade.
- [Tracing](../../../apps/api/src/tracing.ts) exige `OTEL_ENABLED=true`. Confirmar coleta efetiva e instrumentação de Prisma em execução: ativar `pg` não comprova que o engine Prisma está sendo medido. Os snapshots locais expõem médias, insuficientes para p95/p99. Verificar também ordem de inicialização das instrumentações.
- [PrismaService](../../../apps/api/src/prisma/prisma.service.ts) usa `super()`; pool/timeout podem vir de `DATABASE_URL`. Não há dimensionamento explícito no exemplo de produção examinado. Isso não prova pool ilimitado: há defaults do Prisma e possíveis configurações externas.
- [Compose de produção](../../../docker-compose.prod.yml) reúne API/workers no mesmo serviço e não declara orçamento de CPU/memória. Não há alvo publicado de VUs/RPS, hardware ou capacidade comercial. Definir recursos e orçamento de conexões por réplica antes de extrapolar.
- Não foi localizado roteiro de carga k6/Artillery/autocannon nas fontes/scripts examinados. A CI contém testes funcionais de concorrência, recuperação e isolamento; não substituem carga sustentada.

## Verificações executadas

1. Inspeção de rotas/API/BFF/UI, índices no schema/migrations, cache, workers, métricas, limitadores, manifests, Compose e Nginx.
2. Seis reproduções isoladas com módulos compilados locais correspondentes aos serviços examinados, repositórios simulados, sem HTTP/DB: truncamento em 500, ausência de paginação de mensagens, limite elevado de agendamentos, cache concorrente, limites independentes entre instâncias e chaves ilimitadas de métricas. [Resultados](capacity-audit-evidence/reproductions.json) e [script reproduzível](capacity-audit-evidence/reproduce.cjs). Executar após build da API; não mede desempenho e não cria dados persistidos.
3. Jest existente: **5 suítes / 22 testes aprovados** — resumo de clientes, Dashboard, operações por tenant, cardinalidade exportada OTel e exportador de filas. [Log](capacity-audit-evidence/existing-tests.txt). Esses testes não cobrem automaticamente todos os achados novos.
4. `git diff --check` e links locais do relatório conferidos. Sem mudanças de aplicação, não se repetiram build/lint/suíte completa nesta auditoria documental.

## Plano de carga proposto — ainda não executado

Usar ambiente isolado com recursos declarados, banco sem dados reais e provedores mock/sandbox. Preparar três perfis fictícios (valores de ensaio, não capacidade anunciada): pequeno com 300 clientes, médio com 5000, histórico grande com 50000; variar concentração de mensagens/eventos independentemente de clientes. Incluir casos de corte 301/501/1001 e uma conversa com 10000 mensagens. Não fazer o seed pesado antes de definir espaço/tempo disponíveis.

| Etapa | Proposta | O que observar |
| --- | --- | --- |
| Base | 1–5 usuários virtuais, cache frio e quente | Custo por rota/tela, número de queries e payload |
| Crescente | 10 → 25 → 50 → 100 VUs, com pausas humanas | Vazão atingida, p50/p95/p99, erros, pool, CPU, memória e locks |
| Multiempresa | Tenant intenso ao lado de tenant com carga pequena | Justiça, latência e isolamento do tenant menor |
| Pico | Aumentar taxa de mensagens e acessos por curto período | Backlog, idade da fila, 429, retries e tempo para recuperação |
| Sustentado | 2–4 horas em carga abaixo do ponto de saturação | Crescimento de memória/conexões, retenção e filas acumuladas |
| Falha controlada | Indisponibilidade breve de Redis/provedor em sandbox | Recuperação, duplicidade e preservação dos registros |

Mistura inicial sugerida: 70% leituras operacionais, 20% cadastros/atualizações, 10% lifecycle financeiro/mensagens mock; ajustar ao piloto. Cada VU deve usar identidade e organização definidas, respeitar o contrato de versão e chaves idempotentes. Não manter banco/escritas externas reais nesse roteiro.

Metas iniciais propostas: p95 de leitura comum abaixo de 1 s e de gravação abaixo de 2 s, sempre separando 429 esperados de erros inesperados; zero vazamento entre organizações, pagamentos duplicados ou perda de vínculos. Não são SLAs nem resultados obtidos. Definir limite de segurança e interromper a geração de carga se houver degradação grave ou risco ao ambiente; preservar dados para diagnóstico.

A capacidade só poderá ser expressa com hardware, dataset, mistura de operações, duração e métricas: por exemplo, “X organizações, Y usuários ativos, Z operações/s, sob estas condições”. Não é possível converter os 1933 testes funcionais anteriores em número de usuários suportados.

## Sequência recomendada

Primeiro corrigir integridade/completude (C01/C02) e consultas sem limites (C03/C04); em seguida reunir cache concorrente e estabilizar métricas (C06/C08). Depois preparar a medição, investigar planos SQL e validar isolamento de capacidade/filas entre tenants (C05/C07/C09/C10). Não escalar réplicas nem comprar infraestrutura para mascarar cortes silenciosos de dados. Mudanças de contratos e cálculos precisam de regressões específicas antes da publicação.
