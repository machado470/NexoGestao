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
