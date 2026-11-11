# Correções de capacidade e desempenho — 11/11/2026

## Base e entrega

Base `d9d1ce07b19d0d52c2262bf092e6a65c18a3f81d`, originalmente `main` limpa. Branch de trabalho: `fix/capacidade-consultas-e-cache`. O diagnóstico anterior e suas evidências foram preservados. As correções foram desenvolvidas e validadas localmente. Após a validação, o usuário autorizou commit e envio da branch para o GitHub. Não houve deploy. As menções a alterações locais nas etapas abaixo descrevem o estado no momento de cada ensaio.

Nenhum ambiente de produção ou provedor externo foi acionado. Não houve reset, exclusão de volumes nem reescrita de histórico. As migrations novas foram aplicadas apenas a bancos locais de teste. Não se alteraram critérios de risco, valores comerciais de planos ou contratos legados de listagem para arrays/envelopes incompatíveis.

## Resultado por achado

| Achado | Resultado | Implementação e limites |
| --- | --- | --- |
| C01 — cortes na primeira página | **Corrigido nas listas principais; contexto auxiliar sinalizado** | Clientes, Agendamentos e O.S. consultam páginas e filtros no servidor; o BFF preserva totais reais em procedimentos aditivos `page`, mantendo `list`. Clientes aceita filtros de situação/prioridade/risco com a política oficial e localiza a página de um cliente acessado por link. WhatsApp usa cursor, busca/status/prioridade na API e ação para carregar mais conversas. Os filtros anunciados passaram a ser aceitos pelo DTO da API. Coleções auxiliares não foram convertidas em carregamento integral: Clientes sinaliza parcialidade e evita afirmar saldo zero/ausência de atendimento quando não há cobertura suficiente. |
| C02 — resumo corta em 500 | **Corrigido** | A avaliação percorre lotes de 500 clientes com cursor e desempate estável. O total e as classificações cobrem todos os lotes, preservando o contrato e a política. Caso com 501 clientes passou por API, serviço e navegador. |
| C03 — chat sem limite | **Corrigido** | Feed por conversa com cursor, padrão de 50, máximo de 100 e desempate por data/ID. A tela carrega mensagens anteriores sem duplicar nem forçar scroll para o fim a cada página antiga. O endpoint legado continua devolvendo array, agora limitado a uma página; aceita `limit`/`cursor`. Clientes que dependiam de todo o histórico numa só resposta devem migrar ao feed ou percorrer páginas. |
| C04 — limite de agendamentos/calendário | **Corrigido** | API rejeita paginação inválida, limita a 1.000 registros e valida página máxima. BFF valida os mesmos limites. Calendário consulta a janela visível, usa páginas de 200 e oferece navegação quando o período é denso. Buscas recebem debounce; os limites HTTP de leitura acompanham o padrão já usado por Agendamentos. |
| C05 — históricos em memória | **Parcial / mitigado** | O resumo agrega contagens de mensagens com falha e conversas atrasadas por cliente no PostgreSQL; lê as demais coleções relacionadas em lotes de até 1.000, consumidos por iteradores, e carrega no máximo uma relação quando só precisa saber se ela existe. Evita materializar todas as linhas de O.S./agenda/mensagens em paralelo. O contrato completo de resumo e os eventos canônicos usados como fatores foram preservados; a resposta ainda cresce com a carteira e a evidência canônica recente. Não se substituíram as regras por aproximações ou agregações sem equivalência comprovada. A tela usa agora uma rota aditiva de projeção: recebe apenas os resumos dos clientes visíveis (máximo de 100 IDs), mantendo os totais globais da carteira. A rota legada completa permanece disponível. O cálculo global ainda percorre a carteira; materialização de sinais merece evolução específica. |
| C06 — cache concorrente | **Corrigido no processo** | Uma promessa em andamento por chave reúne chamadas concorrentes. Falhas liberam a chave; invalidação durante cálculo impede repopular o cache com dados antigos. Chaves de organizações diferentes permanecem separadas. Não é um cache distribuído entre réplicas. |
| C07 — limites por tenant locais | **Corrigido para os controles de domínio** | Buckets atômicos no PostgreSQL são compartilhados por API/workers. Financeiro e automações aguardam a reserva; o motor pode usar a mesma transação da execução. Estado sobrevive à troca da instância; contadores não diminuem com limites diferentes durante atualização de configuração. Produção não usa fallback local quando a dependência está ausente. Os limitadores HTTP por IP do framework/Nginx são controles distintos e não foram convertidos em quota por organização. |
| C08 — cardinalidade de métricas | **Corrigido no snapshot HTTP** | Middleware usa template da rota e categoria fixa para caminho desconhecido; filtro de exceções também evita URL arbitrária. Métricas aceitam até 500 dimensões HTTP e acumulam o excedente numa categoria fixa, sem perder os totais. Não representa uma política de retenção de todas as demais métricas por tenant. |
| C09 — consulta por ator da Auditoria | **Índice corrigido; custo de agregação a medir** | Migration para `(orgId, actorPersonId, createdAt)`, apoiada por `EXPLAIN (ANALYZE, BUFFERS)` em tabela temporária com 100 mil eventos. Contagens/resumos de todo o histórico continuam com a semântica existente; não há promessa de custo constante nem alteração silenciosa do período consultado. |
| C10 — disputa de fila WhatsApp | **Mitigado; sem garantia de QoS** | Entrada tem fila/worker próprios; o worker antigo continua aceitando jobs já enfileirados no nome legado. Há orçamento compartilhado por tenant no processamento; excesso é adiado sem consumir tentativas de falha. A admissão de novos envios limita rajadas por organização, com padrão técnico de 60/min, configurável até 600/min. Repetições do mesmo job não consomem outra reserva. Entrada persistida não é bloqueada por esse orçamento de envio. O limite global de saída de 10 jobs/s, retries, DLQ e idempotência foram mantidos. Justiça estrita para grandes backlogs legados e SLAs por empresa exigem carga multiempresa e possivelmente outra política de escalonamento. |

## Correções adicionais confirmadas nos testes

- O envio pela conversa passa a resolver telefone/cliente pela conversa autorizada, sem exigir que o consumidor repita o telefone. Conversa de outra organização e cliente incompatível são rejeitados.
- A admissão é reservada antes de persistir ou reativar uma mensagem: a resposta 429 não deixa uma mensagem pendente que seria enviada depois pelo cron.
- O interceptor HTTP de idempotência aceita os dois nomes de cabeçalho, isola chaves por organização, impede execução concorrente da mesma chave e salva a resposta antes de liberar a reserva. Corpo diferente com a mesma chave retorna 409. A retenção/cache existente continua sendo o limite desta garantia; não se afirma processamento exatamente uma vez após perda do cache. Código em [interceptor](../../../apps/api/src/common/idempotency/idempotency.interceptor.ts) e regressões específicas.

## Arquivos principais

- Banco/limites: [schema](../../../prisma/schema.prisma), [bucket compartilhado](../../../prisma/migrations/20261111040000_shared_tenant_rate_limits/migration.sql), [índice por ator](../../../prisma/migrations/20261111041000_audit_actor_index/migration.sql), [TenantOperationsService](../../../apps/api/src/common/tenant-ops/tenant-ops.service.ts), consumidores em Financeiro, Automação e ExecutionRunner.
- Consultas: [resumo de clientes](../../../apps/api/src/customers/customers-operational-summary.service.ts), [listagem de clientes](../../../apps/api/src/customers/customers.service.ts), controller/DTO de Clientes, [Agendamentos](../../../apps/api/src/appointments/appointments.service.ts), [leitura de O.S.](../../../apps/api/src/service-orders/service-order-read.service.ts).
- Cache/métricas: [MemoryCacheService](../../../apps/api/src/common/cache/memory-cache.service.ts), [MetricsService](../../../apps/api/src/common/metrics/metrics.service.ts), middleware de logs e filtro de exceções.
- WhatsApp: [leitura de conversas/mensagens](../../../apps/api/src/whatsapp/whatsapp-conversation-read.service.ts), service/controller/DTO, [entrada de webhook](../../../apps/api/src/whatsapp/whatsapp-webhook.service.ts), [worker](../../../apps/api/src/queue/processors/whatsapp.processor.ts), [admissão](../../../apps/api/src/queue/queue.service.ts), constantes de filas e [.env.prod.example](../../../.env.prod.example).
- BFF: [transporte paginado](../../../apps/web/server/_core/nexoTransport.ts), routers de Clientes, Agendamentos, O.S. e WhatsApp. Contratos antigos preservados por procedimentos aditivos.
- Interface: [Clientes](../../../apps/web/client/src/pages/CustomersPage.tsx), [Agendamentos](../../../apps/web/client/src/pages/AppointmentsPage.tsx), [O.S.](../../../apps/web/client/src/pages/ServiceOrdersPage.tsx), [Calendário](../../../apps/web/client/src/pages/CalendarPage.tsx), [WhatsApp](../../../apps/web/client/src/pages/WhatsAppPage.tsx), hook de debounce e invalidação dos novos leitores após mudanças.

## Validações e dados

Banco exclusivo `nexo_capacity_test`, organização fictícia própria, API `3340`, BFF `3350`, PostgreSQL local `55449`, Redis `56389` com base separada para a aplicação de teste. Dataset: **501 clientes, 501 O.S., 1.001 agendamentos, 55 conversas e 101 mensagens**. Fixtures foram inseridas diretamente no banco para produzir volume; isto não equivale a cadastrar todos esses registros pela interface.

A primeira tentativa de seed de agenda tinha horários sobrepostos no mesmo responsável: a restrição do banco impediu parte das inserções. O fixture foi corrigido com equipe fictícia e horários compatíveis, sem desativar a restrição ou apagar dados.

### API e navegador reais

- Clientes: página 63 acessível com cinco registros finais; busca localizou cliente antigo fora do corte anterior; segunda página e link para o cliente antigo conferidos no Chromium.
- Resumo: API informou 501 clientes e incluiu o registro antigo. A projeção retornou oito clientes em **10.784 bytes**, preservando integralmente os totais da carteira (redução de cerca de 98% frente aos 661.612 bytes da rota legada nesta amostra). [Resultado API/navegador](capacity-fix-evidence/browser-results.json). Regressões de serviço cobrem cliente em risco após o lote 500 e sinais em mais de mil registros relacionados.
- Agenda: limite de um milhão resultou em página de no máximo mil e total real de 1.001; limite negativo retornou 400. Busca no navegador encontrou o agendamento antigo. O Calendário enviou `from/to` e avançou para a segunda página do período.
- O.S.: busca encontrou registro além do corte anterior; filtro sem cobrança conferido por API/interface. As prioridades e filtros foram comparados em PostgreSQL real com as decisões canônicas, incluindo prazos nulos e cobranças. O teste detectou um problema de lógica SQL com `NULL`; a correção passou nos cinco casos de integração.
- WhatsApp: inbox com páginas 50 + 5; busca por conversa antiga; mensagens carregadas em 50 + 50 + 1, com 101 IDs distintos. Inbox móvel permaneceu acessível com seleção persistida não resolvida.
- Envio pelo endpoint normal de conversa, com provedor mock, chegou a SENT; repetição da chave retornou a mesma mensagem, corpo divergente retornou 409 e saturação do orçamento retornou 429 sem persistir outra mensagem. Não houve pagamento nem envio para provedor externo nesta rodada. Os 16 testes operacionais anteriores foram repetidos separadamente com infraestrutura real e limites de seus mocks mantidos.

Resultados adicionais: [navegação e mobile](capacity-fix-evidence/extra-results.json), [envio mock e idempotência](capacity-fix-evidence/send-results.json).

Capturas: [cliente antigo](capacity-fix-evidence/customer-old-search.png), [segunda página](capacity-fix-evidence/customers-page-2.png), [link para página 63](capacity-fix-evidence/customer-deep-link.png), [O.S. antiga](capacity-fix-evidence/order-old-search.png), [agendamento](capacity-fix-evidence/appointment-old-search.png), [calendário](capacity-fix-evidence/calendar-page-2.png), [101 mensagens](capacity-fix-evidence/messages-101.png), [inbox móvel](capacity-fix-evidence/mobile-inbox-recovery.png).

### Concorrência e SQL

- PostgreSQL: duas instâncias competindo pelo mesmo bucket; 30 tentativas produziram somente dez autorizações. Reinício lógico, rollback, expiração e configuração divergente entre instâncias também conferidos.
- Redis real: saída pausada não impediu entrada; um job adiado cedeu processamento a outro tenant. O job adiado completou com uma única tentativa contabilizada. O orçamento foi simulado nesse teste de fila; a atomicidade do orçamento foi testada separadamente no PostgreSQL.
- Índice da Auditoria: plano anterior examinou 10 mil linhas do tenant, descartando 9.800 pelo ator; o índice novo selecionou 200. Tempos observados nessa amostra: 5,953 ms e 0,395 ms. Cache, distribuição sintética e tabela temporária impedem extrapolar esse fator para produção. A transação de ensaio foi revertida.

- Ensaio curto de leitura: cinco clientes HTTP, 150 requisições e 150 respostas 200, em 3,811 s. A rota legada de resumo chegou a 661.612 bytes; isto motivou a projeção usada pela tela. Não mede capacidade máxima ou SLA. [Resultado](capacity-fix-evidence/read-smoke.json).

### Comandos

Executados com PNPM 10.30.3. Evidências finais na pasta deste relatório:

- Suíte consolidada: **1.975 testes passaram** (API 1.173, web 798, common 4); 108 testes da API ficaram desabilitados por configuração na suíte padrão. As integrações explícitas abaixo são execuções separadas, não uma soma de testes inéditos. Contagens finais em [testes](capacity-fix-evidence/tests.txt).
- **26 integrações com infraestrutura real passaram**: nove de PostgreSQL, uma de fila Redis e 16 operacionais anteriores. Integrações novas: [PostgreSQL](capacity-fix-evidence/postgres-real.txt) e [Redis](capacity-fix-evidence/redis-real.txt); [16 integrações anteriores](capacity-fix-evidence/previous-real.txt).
- [Tipos](capacity-fix-evidence/typecheck.txt), [build](capacity-fix-evidence/build.txt), [Prisma Client](capacity-fix-evidence/prisma-check.txt), [comparação schema/banco](capacity-fix-evidence/schema-diff.txt).
- Lint agregado encontrou novamente falha ambiental de obtenção de metadata do PNPM, antes de concluir o validador. [Log do wrapper](capacity-fix-evidence/lint-wrapper.txt). O script real `pnpm --filter @nexogestao/web lint:os` passou: [log](capacity-fix-evidence/lint-direct.txt). Não se alteraram manifests/lockfile para contornar o ambiente.
- `git diff --check` e links locais conferidos. Falhas intermediárias introduzidas nos novos leitores/fixtures foram corrigidas e revalidadas; não são tratadas como falhas preexistentes.

## Continuação: histórico maior e concorrência multiempresa

Adicionado [teste de integração combinado](../../../apps/api/test/integration/capacity-multitenant-postgres-redis.integration.spec.ts), com execução explícita e Redis de loopback na base exclusiva 15. Os dois casos passaram. [Log](capacity-fix-evidence/multitenant-real.txt) e [resultado resumido](capacity-fix-evidence/multitenant-results.json).

- **Histórico**: 10.001 mensagens fictícias com falha, três organizações consultadas em paralelo e projeção solicitando IDs das três empresas. Cada resposta trouxe somente o cliente da organização informada ao serviço. As 10.001 falhas foram contabilizadas; a leitura usou 11 consultas, cada uma limitada a mil registros. As outras empresas não herdaram esses sinais. A chamada conjunta levou 200 ms nesta amostra, sem incluir a inserção do fixture; não é um percentil de desempenho nem custo constante.
- **Fila**: dois processors reais do BullMQ, três organizações e orçamento real compartilhado no PostgreSQL. Foram inseridos primeiro 31 jobs da empresa mais ativa, seguidos de cinco para cada uma das outras. Todos os 41 terminaram em 3,391 s; houve 33 adiamentos por orçamento, sem consumir tentativas de falha. Ambas as empresas menores avançaram antes da conclusão da maior. O handler de domínio de webhook foi simulado; este ensaio valida escalonamento/orçamento, não integração externa ou persistência de mensagens recebidas.
- Fixtures com UUIDs próprios foram removidos ao final; não houve limpeza de dados de outras organizações, flush do Redis ou reset de banco. Os testes usam opt-in e ficam desabilitados no comando padrão. São **dois testes adicionais**, elevando as execuções explícitas com infraestrutura real desta entrega de 26 para 28. A suíte consolidada de 1.975 aprovações acima foi executada antes deste acréscimo; build e código de produção não mudaram nesta continuação.

Para repetir, fornecer `DATABASE_URL` de um banco local de teste já migrado e `CAPACITY_TEST_REDIS_URL` de Redis local exclusivo na base 15, sem workers da aplicação. Executar a partir de `apps/api`:

```bash
RUN_CAPACITY_COMBINED_INTEGRATION=true \
WHATSAPP_PROVIDER=mock WHATSAPP_ALLOW_MOCK=true \
pnpm exec jest --config jest.config.js --runInBand \
  test/integration/capacity-multitenant-postgres-redis.integration.spec.ts
```

Os resultados mitigam parte das lacunas C05/C10. Ainda faltam cenários prolongados, várias réplicas da aplicação completa, falhas de infraestrutura, maior backlog e medição no hardware de destino antes de declarar capacidade ou SLA.

## Ensaio HTTP em etapas

O ensaio reproduzível de rampa, pico e recuperação está em [script](../../../scripts/load/read-stages.cjs), com [instruções](../../../scripts/load/README.md). Executa GET nas cinco famílias de leitura utilizadas pela interface, incluindo a projeção do resumo de Clientes. Usa um login de teste, uma organização e uma instância da API; não é carga multiempresa HTTP. Amostra RSS do processo Node, sem afirmar ausência de vazamento ou medir heap retido após GC.

Resultado: **8.676 requisições, todas HTTP 200**, sem erro inesperado ou 429, em cerca de 110 s. [JSON com percentis por rota e amostras de memória](capacity-fix-evidence/staged-read-results.json), [progresso](capacity-fix-evidence/staged-read-progress.txt).

| Etapa | Clientes HTTP simultâneos | Duração prevista | Requisições | RPS observado | p95 das respostas 200 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Inicial | 5 | 15 s | 601 | 39,86 | 87,41 ms |
| Rampa | 10 | 30 s | 2.281 | 75,83 | 120,23 ms |
| Pico | 20 | 45 s | 4.978 | 110,16 | 319,18 ms |
| Recuperação | 5 | 20 s | 816 | 40,51 | 74,65 ms |

A rota do resumo operacional teve o maior p95 no pico: **428,26 ms**, contra 67,99–96,07 ms nas demais rotas. Reduzir a resposta da tela eliminou tráfego desnecessário, mas não tornou o cálculo global independente do tamanho da carteira. A próxima otimização deve atacar esse cálculo, com equivalência de regras e invalidação verificadas antes de introduzir snapshots/cache adicional. Este ensaio localiza a rota mais custosa; não atribui o custo a uma consulta específica sem profiling.

RSS observado: 205,80 MiB na primeira amostra; máximo de 401,41 MiB; 227,41 MiB na última. Houve redução na recuperação, mas RSS não mede somente objetos vivos e esta janela não comprova ausência de vazamento. Node v24.22.1; quota do workspace de dois CPUs e 8 GiB, compartilhada por API, gerador de carga e infraestrutura local. Banco de teste com 501 clientes e 1.001 agendamentos, uma organização e leituras em modo development. Não equivale a 20 usuários navegando pelo produto completo.

Nesta continuação, adicionaram-se somente o script/documentação do ensaio e evidências. `node --check scripts/load/read-stages.cjs`, a execução integral do ensaio e `git diff --check` passaram. Não se alterou código de produção após o build e a suíte consolidada já registrados. As credenciais do login ficaram em `/tmp`, fora dos artefatos.

## Otimização posterior: contagens do WhatsApp no banco

O [serviço de resumo](../../../apps/api/src/customers/customers-operational-summary.service.ts) passou a usar `groupBy(customerId)` para os dois sinais que só precisam de contagem: mensagens `FAILED` e conversas `WAITING_OPERATOR` com `responseDueAt < evaluatedAt`. Organização e conjunto de clientes continuam nas condições da consulta. Há no máximo 500 grupos por lote de clientes, independentemente do número de mensagens. Não houve mudança de critérios, cache, TTL ou schema.

O ensaio anterior com 10.001 mensagens transferia todas as linhas em 11 consultas. A versão atual retorna um grupo em uma consulta, preservando a contagem 10.001. O teste PostgreSQL confere isolamento entre três organizações e os limites de prazo das conversas: vencido entra; prazo igual ao instante da avaliação, ausente ou situação diferente não entra. Eventos canônicos continuam completos e os outros sinais mantêm suas leituras anteriores. A base ainda precisa examinar as linhas para agregar: o custo não passou a ser constante.

[Resultados da integração atualizada](capacity-fix-evidence/aggregate-real.txt). O tempo de chamada observado foi 164 ms, contra 200 ms no ensaio anterior, mas não se afirma ganho percentual: execuções únicas, caches e tarefas concorrentes diferentes não sustentam essa comparação. O ganho comprovado é a redução das linhas e das consultas necessárias para transportar essa contagem. O ensaio HTTP em etapas acima é anterior à agregação e permanece como evidência histórica, não como benchmark da versão atual.

Validação da versão com agregação: **1.975 testes passaram** na suíte padrão (API 1.173, web 798, common 4; 110 testes de integração da API desabilitados por opt-in). Os dois casos de integração combinada passaram em execução explícita. [Suíte](capacity-fix-evidence/aggregate-tests.txt), [build](capacity-fix-evidence/aggregate-build.txt), [tipos](capacity-fix-evidence/aggregate-typecheck.txt). A compilação inicial do observador de teste expôs uma limitação de tipos genéricos do Prisma; o observador foi corrigido com argumentos explícitos e os testes voltaram a passar.

Na API compilada, o ensaio curto voltou a obter **150 respostas HTTP 200**; a projeção retornou os oito clientes solicitados e total global de 501. [Leituras HTTP](capacity-fix-evidence/aggregate-http.json), [projeção](capacity-fix-evidence/aggregate-projection.json). Não houve nova alteração de interface; a validação de navegador registrada anteriormente permanece identificada como anterior a esta mudança de backend. Sem commit, push ou deploy.

## O que ainda não está comprovado

Estas correções não estabelecem capacidade máxima, RPS comercial ou SLA. Restam carga crescente/multiempresa, pico, recuperação sob saturação e teste prolongado no hardware escolhido. O resumo completo ainda tem resposta proporcional à carteira/evidências recentes; não foi convertido em snapshot materializado. Backlogs legados muito grandes não ganham automaticamente escalonamento estritamente justo. Também não se verificaram Stripe/WhatsApp externos.

O ensaio local de leituras simultâneas está em [script](capacity-fix-evidence/read-concurrency.cjs). É limitado, somente GET, aceita apenas loopback e exige confirmação de dataset isolado. Não cria ou apaga registros e não imprime o token. Deve ser distinguido de teste de carga em produção, pois a API local usa configuração de desenvolvimento.

Antes de executar a API atualizada em outro ambiente, aplicar as duas migrations aditivas: o bucket compartilhado é uma dependência dos novos controles. Para uma tabela de Auditoria grande, planejar a criação do índice e acompanhar bloqueios; não foi feito deploy nesta entrega.
