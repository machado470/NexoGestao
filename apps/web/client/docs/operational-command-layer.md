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
