# Auditoria visual e validação operacional — 10/11/2026

> Atualização de entrega: após as rodadas locais descritas abaixo, o usuário autorizou “Vamos subir já”. As alterações foram preparadas para commit e envio na branch `fix/auditoria-visual-fluxo-operacional`. As menções a “sem commit/push” registram o estado das rodadas anteriores. Não foi autorizado deploy; a `main`, que aciona GitHub Pages, foi preservada.

## Ponto de partida e escopo

- Raiz: `/workspace/NexoGestao`.
- `git status --short --branch` inicial: `## main...origin/main`, sem alterações.
- HEAD inicial: `346455381d0ffcf87b9c92a8cb35e48d0f64c5aa`. Branch mantida em `main`.
- Não há AGENTS.md aplicável nos diretórios ancestrais nem no repositório. Foram lidos README, manifests da raiz/API/web, workspace e scripts de execução/validação.
- Stack: PNPM **10.30.3**, Turbo, React/Vite, BFF tRPC, NestJS, Prisma 5.22, PostgreSQL e Redis.
- Não havia vídeo anexado nesta solicitação; foram usadas as referências textuais A01–A07, o código atual e a interface local real.
- Alterações **locais para revisão**, sem commit, push, deploy, reset de banco, remoção de volumes ou alteração do histórico Git.

## Resultado dos achados

| Achado | Status | Mudança e arquivos | Verificação |
| --- | --- | --- | --- |
| **A01** Estados vazios | **Corrigido** | [CustomersPage](../../../apps/web/client/src/pages/CustomersPage.tsx), [AppointmentsPage](../../../apps/web/client/src/pages/AppointmentsPage.tsx), [ServiceOrdersPage](../../../apps/web/client/src/pages/ServiceOrdersPage.tsx) e [AppPageEmptyState compartilhado](../../../apps/web/client/src/components/internal-page-system.tsx). Ação dentro do estado vazio, mesmo modal do cabeçalho, condicionada à permissão. Filtro sem resultados oferece limpeza. Detalhes recolhidos sem resultados; estados de erro/carregamento preservados. | Chromium: três módulos vazios; criação de cliente/agendamento/O.S.; filtros sem resultados e limpeza nos três; erro de rede simulado em Clientes não virou lista vazia; VIEWER com criação desabilitada. |
| **A02** Governança | **Corrigido** | [GovernancePage](../../../apps/web/client/src/pages/GovernancePage.tsx): topo em Situação atual, Última avaliação e Próxima ação. Ausência usa `availability=NO_DATA`; desatualização usa **somente o sinal oficial** `GOVERNANCE_RUN_STALE`, sem criar regra temporal. Data e ausência de data/recomendação explícitas. Destino respeita RBAC; quando é a própria Governança, o botão atualiza as fontes, sem simular execução. | Chromium e API: avaliação ausente e avaliação datada/desatualizada. Registro datado inserido como fixture no banco isolado. Ação oficial de atribuição em Governança: ADMIN 201, VIEWER 403. |
| **A03** Timeline | **Corrigido** | [TimelinePage](../../../apps/web/client/src/pages/TimelinePage.tsx): marcador, título, horário, descrição e autor na mesma coluna compacta; horário removido da coluna distante à direita. Ordem, filtros, metadados e navegação preservados. | Chromium: um evento filtrado, múltiplos eventos e viewport de **390 px**, sem largura excedente no corpo. Testes de Timeline aprovados. |
| **A04** Rótulos e filtros | **Corrigido** | [presentation-labels](../../../apps/web/client/src/lib/presentation-labels.ts), [AuditPage](../../../apps/web/client/src/pages/AuditPage.tsx), [TimelinePage](../../../apps/web/client/src/pages/TimelinePage.tsx), [GovernancePage](../../../apps/web/client/src/pages/GovernancePage.tsx), [ExecutiveDashboard](../../../apps/web/client/src/pages/ExecutiveDashboard.tsx), [PeoplePage](../../../apps/web/client/src/pages/PeoplePage.tsx). Rótulos em português, fallback explícito para código desconhecido. Auditoria seleciona eventos do resumo/lista e atores das fontes autorizadas `/people`, resumo e eventos. O [serviço de Auditoria](../../../apps/api/src/audit/audit-admin.service.ts) enriquece o resumo com nomes históricos, inclusive pessoas inativas, sempre restrito ao tenant; o [helper de opções](../../../apps/web/client/src/lib/audit-actor-options.ts) combina e deduplica as fontes. Nome com e-mail/ID como identificador secundário. Código e `actorPersonId` originais enviados à API. | Chromium: “Cliente atualizado”, “Paula Almeida”, filtros com `CUSTOMER_UPDATED` e ID real da pessoa. API confirmou ator, entidade e data. Testes de rótulos incluem UNKNOWN, NORMAL, CUSTOMER_UPDATED, UNDER_CAPACITY e código desconhecido. Ator inativo ausente de `/people` e da primeira página de eventos apareceu pelo nome no seletor; filtro retornou seu evento. Resumo negado ao VIEWER (403). Três testes API e cinco web adicionais cobrem essa regressão. A capacidade em Pessoas já tinha rótulos em português; foi preservada e recebeu fallback. |
| **A05** Calendário | **Corrigido** | [CalendarPage](../../../apps/web/client/src/pages/CalendarPage.tsx): altura limitada da grade, cabeçalho de dias fixo no scroll dos horários, contêiner com rolagem horizontal e largura mínima da grade. Lista móvel preservada. | Chromium: scroll vertical com cabeçalho na mesma coordenada antes/depois; diferença horizontal entre cabeçalho/colunas dos horários **0 px**; janela estreita com rolagem horizontal. Métricas em `results.json`. |
| **A06** WhatsApp | **Corrigido** | [WhatsAppPage](../../../apps/web/client/src/pages/WhatsAppPage.tsx): inbox ocupa a largura disponível sem seleção; chat/contexto aparecem após selecionar conversa. Explicação da primeira conversa e estados existentes de busca/loading/indisponibilidade. A validação encontrou e corrigiu também [WhatsAppService](../../../apps/api/src/whatsapp/whatsapp.service.ts): fallback tenant-scoped entre telefone E.164 e os dígitos guardados pelo cadastro; só associa se esse fallback for unívoco. Conversas iniciadas antes do cadastro passam a ser vinculadas quando o contato é identificado, com atualização condicional que não substitui cliente existente. | Chromium: caixa vazia, busca vazia, loading com resposta atrasada, indisponibilidade por aborto de rede, conversa selecionada com contexto do cliente. Webhook **mock → Redis/worker → PostgreSQL**: nova mensagem associada ao cliente; repetição sem duplicar. Quatro regressões de API cobrem telefone nacional/internacional, ausência e ambiguidade; outras três cobrem vínculo posterior, preservação de vínculo existente e concorrência. No navegador e no banco, contato recebido antes do cadastro foi vinculado na mensagem seguinte, preservando a primeira mensagem e a mesma conversa. |
| **A07** Assinatura e planos | **Corrigido** | [BillingPage](../../../apps/web/client/src/pages/BillingPage.tsx), [catálogo normalizado](../../../apps/web/client/src/lib/billing-plan-catalog.ts), [definições comerciais](../../../apps/api/src/common/commercial/default-plan-definitions.ts) e [BillingService](../../../apps/api/src/billing/billing.service.ts). Título, plano atual e opções separados, quotas/preços preservados; API agora publica `billingInterval=month` nos planos pagos e null no gratuito. | API e Chromium: três opções mensais, periodicidade do plano atual, botão atual desabilitado. Plano/status temporários restaurados após o teste. Compatibilidade com API antiga e intervalos desconhecidos testada. |

### Política de periodicidade definida nesta continuação

Após a orientação do usuário **“Você decide”**, adotou-se a política **mensal para os planos pagos**, mantendo o gratuito **sem cobrança recorrente**. A definição foi acrescentada à fonte comercial da API e exposta como campo aditivo `billingInterval` no catálogo. O frontend consome esse campo; não calcula periodicidade pelo preço. Contratos antigos sem o campo e valores desconhecidos continuam mostrando ausência de informação, sem supor mensalidade.

Preços persistidos, quotas, rotas, parâmetros de checkout e IDs Stripe não foram alterados. O builder de criação Prisma continua selecionando apenas os campos do schema existente; não há migration. A periodicidade agora é uma política da aplicação definida nesta tarefa, **não uma confirmação de configuração já existente no Stripe**. Permanece pendente conferir os preços recorrentes do provedor em uma conta de teste, pois não há chave Stripe de teste configurada. Nenhuma configuração externa foi alterada.

## Validação operacional com dados fictícios

Infraestrutura criada exclusivamente para esta tarefa:

- PostgreSQL `nexo-visual-pg`, banco `nexo_visual_test`, loopback `55449`.
- Redis `nexo-visual-redis`, loopback `56389`.
- API local `3300`, BFF/Vite local `3310`.
- Migrações aplicadas com `prisma migrate deploy`, somente nesse banco novo.
- Seed básico/piloto existente para o ADMIN; perfil VIEWER fictício criado para verificar restrições.
- Provedor WhatsApp explicitamente **mock**, com conta de provedor de teste persistida. Nenhum envio para WhatsApp real, nenhuma cobrança por Stripe.

| Etapa | Método executado | Resultado/evidência |
| --- | --- | --- |
| Cliente | **Interface**, modal normal → recarga → leitura no banco | “Cliente Visual Teste”, telefone fictício; cadastro persistido. |
| Agendamento | **Interface**, modal normal → recarga → leitura no banco | Cliente vinculado, data/hora e duração persistidas. |
| O.S. | **Interface**, menu “Criar O.S.” do agendamento → recarga → leitura no banco | “Manutenção visual fictícia”, valor **R$ 125,00**. `customerId` e `appointmentId` conferidos no PostgreSQL. |
| Execução | **API oficial** | Atribuição autorizada; transições `OPEN → ASSIGNED → IN_PROGRESS → DONE`, com versão/timestamp exigidos. Não se contornou o lifecycle. |
| Cobrança | **API oficial**, geração repetida | Uma cobrança vinculada à O.S.; segunda geração manteve **1 cobrança**. |
| Pagamento | **API oficial**, registro manual fictício PIX e repetição da mesma chave | Antes: a receber **R$ 125,00**, recebido **R$ 0,00**. Depois: a receber **R$ 0,00**, recebido **R$ 125,00**. Uma linha de pagamento; resposta repetida com `operation.status=duplicate`. Tela financeira também capturada. |
| Histórico | **API + interface** | Atualização do cliente gerou `CUSTOMER_UPDATED`; Auditoria filtrada por código e ator apresentou Paula Almeida, entidade do cliente e horário. Timeline do cliente consultada; Timeline global verificada no navegador. |
| Governança | **API + interface + fixture de avaliação** | Ausência de avaliação inicialmente; avaliação datada/stale em fixture, exibida com a data e o diagnóstico oficial. A ação `assignment.assign_owner` retornou **201 ADMIN / 403 VIEWER**. Leitura de Governança permitida ao VIEWER pelo RBAC existente. Não foi disparado o motor de avaliação manual, desabilitado no ambiente. |
| WhatsApp | **Webhook mock + worker real + banco + interface** | Após corrigir o lookup de telefone, mensagem `mock-visual-inbound-2` associada ao cliente e à conversa. Repetição manteve **1 mensagem** com esse identificador. Conversa e contexto conferidos na interface. |
| Configuração da organização | **API PATCH → GET → restauração → GET** | Nome alterado para “Organização Visual Fictícia”, persistência confirmada; nome original “Serviços Viva - Ambiente Piloto” restaurado e relido. |

IDs, indicadores e resultados detalhados: [results.json](visual-audit-evidence/results.json). Os registros e fixtures pertencem apenas ao banco isolado; nenhum registro compartilhado foi modificado. O teste temporário do plano atual também restaurou o plano/status original.

As primeiras tentativas do roteiro de API demonstraram os guardrails existentes: transição direta `OPEN → DONE`, atualização protegida sem `expectedUpdatedAt` e filtro de Timeline fora do contrato foram rejeitados com 400. O roteiro foi corrigido para usar as transições, controle de versão e endpoint contextual oficiais; não se alterou a aplicação para aceitar essas requisições inválidas.

### Falhas adicionais reproduzidas durante A06

Antes da correção, a mensagem mock era recebida, mas `WhatsAppMessage.customerId` ficava nulo: Clientes grava `11999998877`, enquanto o webhook procurava somente `+5511999998877`. A consulta agora mantém a busca exata original e, se não encontrar, procura formatos numéricos dentro do mesmo `orgId`, com no máximo dois candidatos. Ausência ou ambiguidade não escolhe um cliente arbitrário. Nenhum telefone histórico foi regravado e não houve migration. A mensagem de reprodução original foi preservada no banco de teste; a nova tentativa, após build/reinício local da API, confirmou a associação correta.

Também foi validado o caso em que a conversa chega antes do cadastro: a mensagem seguinte vinculou o cliente recém-criado à mesma conversa. A atualização usa `orgId`, telefone, ID da conversa e `customerId=null` como condições; não sobrescreve vínculo existente. A mensagem anterior permaneceu inalterada. O contexto oficial ficou `GENERAL`, pois o cliente não tinha cobrança, agendamento ou O.S. ativos. A expectativa inicial do roteiro de teste foi corrigida para esse contrato; nenhuma regra de contexto foi alterada.

## Comandos e resultados

Executados com o PNPM fixado (`npx --yes pnpm@10.30.3`), sem instalar dependências do projeto ou modificar manifests/lockfile:

| Verificação | Resultado |
| --- | --- |
| `pnpm test` na raiz | **Passou**: 1.116 testes API (167 suítes), 792 testes web (98 arquivos), 4 testes common; três tarefas Turbo aprovadas. **98 testes / 28 suítes de integração desativados** na execução padrão; 16 deles foram executados separadamente com infraestrutura real, conforme a linha de integrações abaixo. |
| Jest unitário API (rodada inicial) | **Passou**: 162 suítes / 1.083 testes, incluindo quatro regressões novas da associação WhatsApp. |
| Vitest web completo | **Passou**: 98 arquivos / 792 testes, incluindo rótulos, oito casos novos de periodicidade e cinco casos de atores históricos. |
| Vitest focado após os últimos ajustes de apresentação | **Passou**: 23 testes de Auditoria, Timeline e rótulos; mais 12 de Governança/rótulos no ajuste anterior. |
| `pnpm -r typecheck` | **Passou** nos três pacotes. `tsc --noEmit` web/API repetidos ao final também passaram. |
| `pnpm build` | **Passou** nos três pacotes; repetido após os últimos ajustes. |
| `pnpm --filter @nexogestao/web lint:os` | **Passou**. É o validador efetivamente utilizado pelo lint web do projeto. |
| `pnpm lint` agregado | **Falhou por ambiente** antes do validador: a instância PNPM presente no workspace tentou obter `pnpm-10.30.3.tgz` e recebeu `ECONNREFUSED`. Repetição com o proxy herdado teve a mesma falha. Execução direta do script e execução `lint:os` pelo PNPM fixado passaram. Manifests não foram alterados para contornar isso. |
| `pnpm prisma:check` pelo PNPM fixado | **Passou**: schema validado e Client gerado/alinhado. Uma chamada direta inicial resolveu o PNPM global incompatível e foi rejeitada; a repetição com o gerenciador correto passou. |
| Integrações reais selecionadas, `RUN_REAL_INTEGRATION=true` | **Passou**: 4 suítes / **16 testes** em PostgreSQL/Redis reais. Banco adicional `nexo_visual_integration_test`; dados da validação visual preservados. Fluxo operacional canônico e isolamento, privacidade de responsáveis, lifecycle financeiro com timezone e fila Redis. A fila testa infraestrutura Redis real com fontes financeiras simuladas; não representa chamada a provedor externo. |
| Testes focados de periodicidade | **Passou**: 18 testes API/Billing e 21 web/catálogo, incluindo intervalos desconhecidos e contrato antigo. |
| `git diff --check` | **Passou**. |
| Chromium/Playwright | **Passou**: fluxo de cadastro, recarga, filtros, RBAC visual, calendário, estados de indisponibilidade simulada e contexto do WhatsApp. |

As asserções de contrato que exigiam o texto antigo foram atualizadas para os novos rótulos solicitados; os testes de preservação dos códigos, fontes oficiais, permissões e contratos continuam presentes. Não há falha funcional de teste pendente introduzida nesta tarefa.

Logs preservados: [testes](visual-audit-evidence/tests.log), [tipos](visual-audit-evidence/typecheck.log), [build](visual-audit-evidence/build.log), [lint executado](visual-audit-evidence/lint.log), [última repetição web](visual-audit-evidence/web-final.log), [integrações reais](visual-audit-evidence/real-integrations.log), [periodicidade no navegador/API](visual-audit-evidence/billing-period.json).

## Evidências visuais

Capturas feitas no Chromium local, usando a aplicação real e os registros do banco de teste. Ausência e erro simulados estão identificados, sem confundir mock de rede com indisponibilidade real do provedor.

- A01: [Clientes sem registros](visual-audit-evidence/customers-empty.png), [Agendamentos sem registros](visual-audit-evidence/appointments-empty.png), [O.S. sem registros](visual-audit-evidence/service-orders-empty.png), [filtro sem resultados](visual-audit-evidence/customer-filter-empty.png), [erro de rede simulado](visual-audit-evidence/customer-error.png).
- Vínculos persistidos: [O.S. criada a partir do agendamento](visual-audit-evidence/order-linked.png), [financeiro após o pagamento](visual-audit-evidence/finance-paid.png).
- A02: [avaliação ausente](visual-audit-evidence/governance-empty.png), [avaliação datada e desatualizada](visual-audit-evidence/governance-stale.png).
- A03: [um evento em largura estreita](visual-audit-evidence/timeline-single-narrow.png).
- A04: [Auditoria com filtros legíveis](visual-audit-evidence/audit-filtered.png), [perfil de consulta](visual-audit-evidence/viewer-permissions.png), [ator histórico inativo selecionado](visual-audit-evidence/audit-historical-actor.png), [resultado API/navegador](visual-audit-evidence/audit-historical-actor.json).
- A05: [grade após scroll vertical](visual-audit-evidence/calendar-scrolled.png), [grade com scroll horizontal](visual-audit-evidence/calendar-horizontal.png).
- A06: [inbox vazio](visual-audit-evidence/whatsapp-empty.png), [conversa e cliente selecionados](visual-audit-evidence/whatsapp-selected.png), [busca sem resultados](visual-audit-evidence/whatsapp-search-empty.png), [indisponibilidade de rede simulada](visual-audit-evidence/whatsapp-error.png), [cliente cadastrado após o primeiro contato](visual-audit-evidence/whatsapp-register-later.png), [vínculos e preservação da mensagem anterior](visual-audit-evidence/whatsapp-register-later.json).
- A07: [plano atual e opções mensais disponíveis](visual-audit-evidence/billing-monthly.png). Plano atual provisionado apenas como fixture, restaurado ao terminar; não representa compra externa.

## Parecer e pendências

O percurso **Cliente → Agendamento → O.S. → Cobrança → Pagamento → Histórico** foi exercitado com dados persistidos, não apenas inspecionado por código. Cliente/agendamento/O.S. passaram pela interface; cobrança/pagamento/lifecycle e configuração passaram pela API canônica; histórico, calendário e permissões foram conferidos também na interface.

A01–A07 estão corrigidos. Permanecem pendentes: contratação e configuração dos preços mensais no Stripe em conta de teste, canais WhatsApp externos e as demais integrações não selecionadas para execução real. A suíte padrão ainda marca 98 testes como desativados; os 16 executados separadamente não devem ser confundidos com integrações não exercitadas. O mock de WhatsApp e o registro manual de pagamento não substituem testes reais desses provedores. O problema de execução do wrapper agregado de lint é ambiental; a validação de interface que ele chama passou.

Os comandos/scripts transitórios de navegador e API ficam em `/tmp/nexo-visual-*.cjs` nesta sessão. Evidências permanentes para revisão estão neste diretório. API, BFF e os dois contêineres exclusivos da tarefa foram encerrados após a verificação (inclusive a continuação de A07). Contêineres/volumes e dados fictícios foram preservados, sem remoção. Nenhum recurso de produção foi utilizado.

## Revisão adicional — atribuição de ator na Auditoria

Foi encontrada e corrigida uma falha adicional em `AuditAdminService.listEvents` e `getEventDetail`: registros com `actorPersonId` ou `actorUserId`, mas sem nome de pessoa disponível, eram apresentados como “Sistema”. Agora mostram “Ator não identificado”; “Sistema” fica reservado aos eventos sem esses identificadores. Nome conhecido e todos os IDs originais são preservados. Arquivos: [serviço](../../../apps/api/src/audit/audit-admin.service.ts) e [testes](../../../apps/api/src/audit/audit-admin.service.spec.ts).

Verificação automatizada: dois casos falharam antes da correção; após o ajuste, **7 testes passaram**, incluindo os três testes anteriores do resumo e quatro casos de atribuição na lista e no detalhe. A checagem de tipos da API e `git diff --check` passaram. Essa revisão foi validada por teste de serviço, sem nova execução no navegador ou de toda a suíte; os totais da rodada completa acima referem-se à versão anterior a este último ajuste.

Evidências: [reprodução antes](visual-audit-evidence/actor-attribution-before.log), [testes após](visual-audit-evidence/actor-attribution-after.log), [tipos API](visual-audit-evidence/actor-attribution-types.log). Sem commit, push ou deploy.

## Revisão adicional — paginação da Auditoria

A leitura do controller confirmou que os parâmetros HTTP chegam sem DTO de validação ao serviço. Páginas negativas/fracionárias e limites negativos/fracionários ou infinitos podiam alcançar o Prisma. O serviço agora retorna **400 antes de consultar o banco** nesses casos e também protege contra deslocamentos fora da precisão numérica segura. Foram preservados o padrão de página 1/limite 50, o comportamento anterior para zero, strings numéricas recebidas via HTTP e o teto de 100 registros.

Arquivos: [AuditAdminService](../../../apps/api/src/audit/audit-admin.service.ts) e [testes](../../../apps/api/src/audit/audit-admin.service.spec.ts). Seis casos reproduziram a ausência de validação antes do ajuste; depois, **17 testes do serviço passaram**, incluindo os testes anteriores de atribuição/resumo e quatro casos de compatibilidade de paginação. Tipos da API e `git diff --check` passaram. Verificação por testes automatizados de serviço; sem nova execução HTTP/navegador ou repetição da suíte completa nesta revisão.

Evidências: [antes](visual-audit-evidence/audit-pagination-before.log), [após](visual-audit-evidence/audit-pagination-after.log), [tipos](visual-audit-evidence/audit-pagination-types.log). Alterações mantidas locais, sem commit, push ou deploy.

## Revisão adicional — período da Auditoria e suíte consolidada

Lista e resumo ignoravam datas não interpretáveis e consultavam registros sem o limite inválido. Agora uma validação compartilhada rejeita essas datas e períodos invertidos com **400 antes de consultar o banco**. Limites inclusivos, filtros com apenas início/fim e ausência de período foram preservados. Arquivos: [serviço](../../../apps/api/src/audit/audit-admin.service.ts) e [testes](../../../apps/api/src/audit/audit-admin.service.spec.ts).

Três casos reproduziram a falha antes do ajuste; **24 testes do serviço passaram** após a correção. Tipos da API e `git diff --check` passaram. A suíte completa foi executada novamente após todas as revisões adicionais: **1.137 API + 792 web + 4 common = 1.933 testes aprovados**, com 98 testes API desativados na configuração padrão. Web/common foram recuperados do cache Turbo; API executada novamente. As 16 integrações reais descritas anteriormente não foram repetidas nesta revisão. Os totais anteriores ficam como histórico das rodadas.

Esta revisão dos filtros foi verificada por testes de serviço, sem nova execução no navegador. Evidências: [reprodução](visual-audit-evidence/audit-dates-before.log), [testes corrigidos](visual-audit-evidence/audit-dates-after.log), [tipos](visual-audit-evidence/audit-dates-types.log), [suíte consolidada](visual-audit-evidence/consolidated-tests.log). Alterações locais, sem commit, push ou deploy.

## Revisão adicional — detalhe consistente com os filtros

Em Clientes e Agendamentos, a seleção do detalhe procurava o registro na coleção completa. Ao filtrar mantendo outros resultados, era possível continuar exibindo um registro excluído pelo filtro. A seleção apresentada agora é derivada da coleção filtrada, preservando o identificador selecionado: se o registro não estiver nos resultados, aparece a orientação existente para selecionar um registro; limpar filtros permite recuperar a seleção anterior. A O.S. já derivava seu detalhe da coleção filtrada e não precisou deste ajuste. Arquivos: [Clientes](../../../apps/web/client/src/pages/CustomersPage.tsx) e [Agendamentos](../../../apps/web/client/src/pages/AppointmentsPage.tsx).

Verificação: inspeção do fluxo de dados, checagem de tipos web, **29 testes existentes em dois arquivos aprovados** e `git diff --check`. Esses testes são contratos existentes das páginas; não representam nova reprodução no navegador da interação seleção/filtro. A validação visual dessa interação específica continua pendente. As evidências da rodada são [testes](visual-audit-evidence/selection-tests.log) e [tipos](visual-audit-evidence/selection-types.log). Sem commit, push ou deploy.

## Verificação para envio ao Git

Após a autorização do usuário para subir, `pnpm test` passou novamente: web executada com 98 arquivos/792 testes; API/common reutilizados do cache da rodada consolidada (1.137/4), totalizando 1.933 testes. `pnpm build` passou nos três pacotes, com API e web reconstruídas. Evidências: [testes](visual-audit-evidence/publish-tests.log) e [build](visual-audit-evidence/publish-build.log). Envio preparado em branch de revisão, sem merge na main ou deploy.
