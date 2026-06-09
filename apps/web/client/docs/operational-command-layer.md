# Camada operacional transversal do NexoGestão

## Objetivo

A camada operacional transversal transforma o Dashboard em uma mesa de comando única. Em vez de abrir com KPIs genéricos ou módulos isolados, ela responde primeiro:

1. qual é o estado da operação;
2. qual risco importa agora;
3. qual ação deve ser executada;
4. onde a cadeia Cliente → Agendamento → O.S. → Cobrança → Pagamento → Timeline → Risco/Governança está travando.

Essa camada não cria regra de negócio nova, não muda contrato de API e não inventa backend. Ela organiza leituras já disponíveis e mostra fallbacks explícitos quando algum dado não existe ou está indisponível.

## Componentes canônicos

### `OperationalStateCard`

Mostra o estado atual da operação ou do contexto.

Use para exibir:

- nível operacional (`NORMAL`, `WARNING`, `RESTRICTED`, `SUSPENDED`);
- motivo principal;
- impacto operacional;
- CTA para detalhes quando houver página relacionada.

### `NextBestActionCard`

Padrão único para Próxima Melhor Ação no app.

Use para exibir:

- título da ação;
- entidade relacionada;
- motivo;
- impacto esperado;
- observação de segurança quando existir;
- CTA principal;
- CTA secundário opcional.

Regra: novas próximas ações não devem criar card visual local. Elas devem adaptar seus dados para este componente.

### `OperationalFlowCard`

Mostra a operação como cadeia viva, não como menu de módulos.

Etapas esperadas:

`Cliente → Agendamento → O.S. → Cobrança → Pagamento → Timeline → Risco/Governança`

Cada etapa deve informar:

- label;
- status visual;
- resumo curto;
- contagem ou valor quando existir;
- estado (`done`, `active`, `warning`, `blocked`, `idle`);
- link opcional para a página relacionada.

### `EntityTimelineCard`

Mostra a Timeline como prova oficial contextual.

Use para exibir:

- título e subtítulo;
- lista curta de eventos oficiais;
- tipo do evento;
- data/hora;
- entidade relacionada;
- ator/responsável quando existir;
- resumo legível;
- link para a Timeline completa.

A linguagem deve reforçar “últimos eventos oficiais” ou “prova operacional”.

## Regras de uso

- Usar tokens existentes do Nexo e manter compatibilidade light/dark.
- Não usar Flowbite como dependência.
- Não criar dark mode local.
- Não usar fundos escuros hardcoded em componentes internos.
- Não duplicar próxima ação local: adaptar para `NextBestActionCard`.
- Não criar timeline visual solta: usar `EntityTimelineCard` quando o objetivo for prova operacional.
- Não esconder risco apenas em Governança: risco relevante deve aparecer no Dashboard e nos contextos decisórios.
- Não alterar banco, backend ou contrato de API para usar esta camada.
- Quando dado não existir, mostrar fallback seguro e explícito, sem exemplos fictícios.

## Aplicação inicial

A primeira aplicação é no Dashboard principal (`ExecutiveDashboard`):

1. Estado da operação;
2. Maior risco / atenção imediata;
3. Próxima Melhor Ação;
4. Fluxo operacional transversal;
5. Prova operacional da Timeline;
6. Fila operacional;
7. KPIs como apoio, não como abertura decisória.

## Páginas alvo futuras

- Clientes;
- Financeiro;
- WhatsApp;
- Agendamentos;
- O.S.

Essas páginas devem adotar a camada gradualmente, sem refatoração global e sem criar padrões paralelos.

## Adoção em Clientes

A página de Clientes (`CustomersPage`) adota a camada operacional transversal no detalhe do cliente para funcionar como um dossiê operacional, não apenas como lista/cadastro. Ao selecionar um cliente, a leitura passa a abrir com resumo do relacionamento e, em seguida, com os componentes canônicos da Operational Command Layer.

### Como Clientes usa a camada

- `OperationalStateCard` resume o estado operacional do cliente selecionado, com motivo principal, impacto operacional e CTA para a etapa relacionada.
- `OperationalRiskCard` explicita o risco dominante ou a ausência de risco relevante sem criar bloco visual paralelo.
- `NextBestActionCard` substitui orientação local solta por uma próxima melhor ação canônica, sempre sem execução automática.
- `OperationalFlowCard` mostra a cadeia `Cliente → Agendamento → O.S. → Cobrança → Pagamento → Timeline → Risco/Governança` com estados por etapa.
- `EntityTimelineCard` apresenta os últimos eventos oficiais/contextuais como prova operacional do cliente.

### Dados reaproveitados

Clientes reaproveita exclusivamente dados já disponíveis na página e no workspace do cliente:

- cliente selecionado e dados cadastrais;
- agendamentos relacionados;
- ordens de serviço relacionadas;
- cobranças pendentes, vencidas e pagas;
- último pagamento inferido das cobranças retornadas;
- telefone/WhatsApp para ação assistida;
- timeline/eventos oficiais retornados pelo workspace;
- sinais já calculados de risco, pendência, O.S. aberta e ausência de movimentação recente.

### Fallbacks seguros

Quando não há endpoint específico de decisão, Clientes calcula fallback local com os dados já carregados:

1. cobrança vencida recomenda cobrar o cliente;
2. O.S. aberta ou atrasada recomenda acompanhar/abrir ordem de serviço;
3. agendamento sem confirmação ou futuro recomenda confirmar agenda;
4. ausência de movimentação recente recomenda enviar mensagem;
5. ausência de agenda futura recomenda criar novo agendamento;
6. sem pendências recomenda revisar histórico oficial.

Esses fallbacks são declarados no card de Próxima Melhor Ação e não executam nada automaticamente. Se a timeline não retornar eventos, `EntityTimelineCard` mostra fallback explícito e não cria histórico fictício.

### Diretriz para próximas páginas

Clientes agora serve como segunda prova do padrão operacional transversal depois do Dashboard: cada módulo deve adaptar seus dados existentes aos componentes canônicos, manter fallbacks explícitos e evitar criar cards paralelos de próxima ação, fluxo ou timeline. Novas páginas devem seguir o mesmo padrão sem alterar backend, banco, contratos de API ou regras de negócio apenas para adotar a camada.

## Adoção em Financeiro

A página de Financeiro (`FinancesPage`) adota a camada operacional transversal para transformar a carteira de cobranças em controle operacional de receita. A primeira leitura deixa de ser apenas KPI/lista e passa a responder qual dinheiro está travado, quem deve ser cobrado agora, qual risco financeiro existe e onde isso aparece no fluxo `Cobrança → Pagamento → Timeline → Risco/Governança`.

### Como Financeiro usa a camada

- `OperationalStateCard` abre a página com estado financeiro operacional (`NORMAL`, `WARNING` ou `RESTRICTED`) a partir de vencidas, valor vencido, pendências, vencimentos próximos, pagamentos recebidos e O.S. concluídas sem cobrança quando esse dado já está carregado.
- `OperationalRiskCard` explica o risco com valor vencido, quantidade de cobranças vencidas, maior/médio atraso calculado por `dueDate` e cobrança/cliente mais crítico.
- `NextBestActionCard` concentra a Próxima Melhor Ação financeira, sem execução automática: cobrar vencida, enviar link antes do vencimento, revisar recebimento, gerar cobrança para O.S. concluída sem cobrança ou revisar carteira.
- `OperationalFlowCard` mostra a cadeia `Cliente → O.S. → Cobrança → Pagamento → Timeline → Risco/Governança` com estados `done`, `warning`, `blocked` ou `idle` conforme os dados financeiros carregados.
- `EntityTimelineCard` substitui timeline visual solta por prova operacional financeira: usa eventos oficiais quando a Timeline retorna dados e, quando não retorna, exibe fallback contextual derivado de cobranças/pagamentos carregados, deixando claro que não substitui a Timeline oficial.

### Dados reaproveitados

Financeiro reaproveita apenas dados já disponíveis na página:

- cobranças retornadas por `finance.charges.list` e detalhe por `finance.charges.getById`;
- status, valor, vencimento e pagamentos vinculados à cobrança;
- clientes carregados para enriquecer nome e vínculo operacional;
- O.S. carregadas para indicar origem e detectar O.S. concluída sem cobrança;
- campos existentes de comunicação/WhatsApp somente como leitura ou CTA contextual já existente;
- eventos oficiais de Timeline por cliente e por O.S. quando retornados pelos endpoints já usados.

### Fallbacks seguros

- Se não há Timeline retornada, a página informa fallback contextual e não cria histórico fictício.
- Se a lista geral de pagamentos não está exposta, a leitura usa pagamentos vinculados ao detalhe da cobrança e sinaliza essa limitação.
- Se telemetria de WhatsApp/comunicação não vem no payload, Financeiro não inventa falha de envio; apenas mantém CTA contextual existente.
- `SUSPENDED` não é usado em Financeiro sem dado real que comprove suspensão.
- A Próxima Melhor Ação apenas orienta o operador; não envia mensagem, não registra pagamento e não altera cobrança automaticamente.

### Relação Cobrança → Pagamento → Timeline → Risco/Governança

Financeiro trata cobrança como ponte entre operação concluída e caixa. Cobrança vencida bloqueia o estágio de pagamento, aumenta risco financeiro, deve gerar prova operacional na Timeline quando houver ação real e alimenta a leitura de Governança. Cobrança pendente próxima do vencimento fica em atenção preventiva. Cobrança paga sem pagamento vinculado vira revisão de recebimento para evitar divergência entre status financeiro e prova operacional.

### Congelamento de WhatsApp e próximas páginas

WhatsApp permanece congelado nesta adoção: `WhatsAppPage.tsx` não deve ser alterado, não há novo fluxo de comunicação e os CTAs continuam apenas navegando para o contexto já existente. Depois de Financeiro, as próximas páginas candidatas para adoção da Operational Command Layer são O.S. e Agendamentos.
