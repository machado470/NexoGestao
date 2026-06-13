# Dashboard como Centro de Comando Operacional

## Objetivo

O `ExecutiveDashboard` é o cockpit diário do NexoGestão. Ele não deve atuar como home genérica, relatório de BI ou vitrine de KPIs: sua função é responder rapidamente como está a operação, o que está errado, qual é a próxima melhor ação e onde o fluxo está perdendo velocidade ou dinheiro.

## Estrutura final

1. **Header Operacional** — título `Operação hoje`, período atual, estado `NORMAL`, `WARNING`, `RESTRICTED` ou `SUSPENDED`, quantidade de riscos críticos e gargalo principal quando calculável.
2. **Bloco compacto de estado + prova** — substitui os antigos cards altos de estado/maior risco/prova por uma leitura executiva curta: estado operacional, motivo principal, impacto e CTA real para o módulo responsável, ao lado de até 3 eventos oficiais resumidos com CTA para a Timeline.
3. **Atenção Imediata** — painel de incidentes com até 5 riscos ordenados por severidade/impacto, exibindo severidade, título curto, número principal quando a fonte retornar, impacto em uma linha e CTA real; fica na primeira dobra e evita repetir “Motivo”/“Impacto” como relatório.
4. **Próxima Melhor Ação** — sinal do endpoint existente de next-best-action ou fallback seguro baseado em alertas reais já carregados, em card com valor, prazo ou status em destaque, entidade visível, motivo, impacto esperado, segurança e CTA principal.
5. **KPIs Operacionais** — indicadores compactos com microcontexto e CTA para o módulo dono; valores zerados continuam explícitos, mas recebem microcopy humana como “Sem pagamentos registrados no período”.
6. **Fluxo Operacional** — assinatura Cliente → Agendamento → O.S. → Cobrança → Pagamento, com estado por etapa e leitura de gargalo em cards reduzidos.
7. **Pulso da Operação** — leitura humana de caixa, execução, comunicação e comparações históricas quando a API entregar base; aparece antes da fila para ganhar visibilidade sem competir com Atenção/NBA.
8. **Fila Operacional** — até 10 itens acionáveis da fila transversal retornada pelo dashboard alerts, apresentada como linhas operacionais priorizadas em vez de tabela administrativa pesada. Responsável ausente aparece como `—` discreto e nota agregada no rodapé.
9. **Acessos Rápidos Contextuais** — atalhos secundários para os módulos operacionais.

## Fontes usadas

- `trpc.dashboard.kpis`: métricas de clientes, O.S., financeiro, comparações, WhatsApp Signals e governança quando retornados pelo BFF atual.
- `trpc.dashboard.alerts`: O.S. atrasadas, cobranças vencidas, serviços concluídos sem cobrança, agenda/serviços do dia, clientes com pendência e `operationalQueue`.
- `/internal/operational-signals?limit=8`: sinais de risco operacionais existentes.
- `/internal/operational-signals/next-best-action`: próxima melhor ação real do motor operacional existente.
- `trpc.nexo.timeline.listByOrg`: prova operacional recente.
- `trpc.nexo.whatsapp.listPendingApprovals`: aprovações WhatsApp existentes, sem alterar a `WhatsAppPage`.

## Regras de fallback honesto

- Sem prazo válido, o dashboard mostra `Prazo não informado` e não calcula atraso.
- Sem responsável no payload, a fila mostra `—` na linha com `title`/`aria-label` de `Responsável não informado` e uma nota agregada quando houver muitos itens sem responsável.
- Sem histórico de comparação, o pulso mostra que a base histórica ainda está em formação.
- Sem Timeline ou erro na leitura, a interface não cria prova operacional artificial; o bloco compacto mostra fallback curto e direciona para a Timeline completa.
- Sem governança/risk explícito, o header declara que o estado operacional não foi retornado pela fonte atual e deriva nível apenas de alertas/sinais carregados.
- Sem status WhatsApp, o dashboard não afirma ausência de resposta; só usa `whatsappSignals` ou itens da `operationalQueue` quando retornados.
- Sem valor financeiro, o dashboard não calcula impacto monetário; Atenção Imediata e NBA destacam contagem, prazo, status ou entidade disponível e direcionam para validação no módulo dono.
- Sem `entityId` específico, o CTA abre o módulo responsável em vez de criar link de detalhe fictício.

## CTAs permitidos e preservados

Os CTAs levam para módulos existentes: O.S., Financeiro, Agendamentos, WhatsApp, Timeline, Governança e Clientes. O resumo de estado usa o CTA do maior risco quando há risco real; sem risco, abre Governança. Eles apenas navegam para contexto real; não disparam cobrança, WhatsApp, automação ou alteração de status automática.

## Diferença para páginas específicas

O Dashboard prioriza e roteia decisões transversais. Clientes, Agendamentos, O.S., Financeiro, WhatsApp, Timeline e Governança continuam responsáveis por execução detalhada, filtros profundos, edição, automações existentes e histórico completo. Páginas específicas não devem duplicar o cockpit completo; devem receber o usuário já orientado pelo contexto do Dashboard.

## Limites preservados

Esta etapa não altera backend, API, Prisma, rotas, contratos multi-tenant, payloads, endpoints, fontes de dados existentes, segurança multi-tenant, lógica de automação ou `WhatsAppPage`. Lacunas de dados devem ser tratadas como gaps futuros de BFF/API, não como mock no frontend.

## Gaps futuros identificados

- Estado operacional canônico de governança/risk nem sempre aparece no contrato do `dashboard.kpis`.
- Conversões reais entre etapas do fluxo ainda dependem de payloads mais ricos; hoje o cockpit só aponta gargalos quando há alertas concretos.
- Responsável, prazo detalhado e entityId nem sempre vêm na `operationalQueue`; o dashboard usa fallback discreto, nota agregada e CTA para módulo nesses casos.
- Tendências só aparecem quando `metrics.comparison` retorna percentuais; sem histórico suficiente, a UI declara a limitação.
