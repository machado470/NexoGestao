# Dashboard como Centro de Comando Operacional

## Objetivo

O `ExecutiveDashboard` é o cockpit diário do NexoGestão. Ele não deve atuar como home genérica, relatório de BI ou vitrine de KPIs: sua função é responder rapidamente como está a operação, o que está errado, qual é a próxima melhor ação e onde o fluxo está perdendo velocidade ou dinheiro.

## Estrutura final

1. **Header Operacional** — título `Operação hoje`, período atual, estado `NORMAL`, `WARNING`, `RESTRICTED` ou `SUSPENDED`, quantidade de riscos críticos e gargalo principal quando calculável.
2. **Atenção Imediata** — até 5 riscos ordenados por severidade/impacto, sempre com motivo, impacto e CTA real.
3. **Próxima Melhor Ação** — sinal do endpoint existente de next-best-action ou fallback seguro baseado em alertas reais já carregados.
4. **KPIs Operacionais** — indicadores compactos com microcontexto e CTA para o módulo dono.
5. **Fluxo Operacional** — assinatura Cliente → Agendamento → O.S. → Cobrança → Pagamento, com estado por etapa e leitura de gargalo.
6. **Fila Operacional** — até 10 itens acionáveis da fila transversal retornada pelo dashboard alerts.
7. **Pulso da Operação** — leitura humana de caixa, execução, comunicação e comparações históricas quando a API entregar base.
8. **Acessos Rápidos Contextuais** — atalhos secundários para os módulos operacionais.

## Fontes usadas

- `trpc.dashboard.kpis`: métricas de clientes, O.S., financeiro, comparações, WhatsApp Signals e governança quando retornados pelo BFF atual.
- `trpc.dashboard.alerts`: O.S. atrasadas, cobranças vencidas, serviços concluídos sem cobrança, agenda/serviços do dia, clientes com pendência e `operationalQueue`.
- `/internal/operational-signals?limit=8`: sinais de risco operacionais existentes.
- `/internal/operational-signals/next-best-action`: próxima melhor ação real do motor operacional existente.
- `trpc.nexo.timeline.listByOrg`: prova operacional recente.
- `trpc.nexo.whatsapp.listPendingApprovals`: aprovações WhatsApp existentes, sem alterar a `WhatsAppPage`.

## Regras de fallback honesto

- Sem prazo válido, o dashboard mostra `Prazo não informado` e não calcula atraso.
- Sem responsável no payload, a fila mostra `Responsável não informado`.
- Sem histórico de comparação, o pulso mostra que a base histórica ainda está em formação.
- Sem Timeline ou erro na leitura, a interface não cria prova operacional artificial.
- Sem governança/risk explícito, o header declara que o estado operacional não foi retornado pela fonte atual e deriva nível apenas de alertas/sinais carregados.
- Sem status WhatsApp, o dashboard não afirma ausência de resposta; só usa `whatsappSignals` ou itens da `operationalQueue` quando retornados.
- Sem valor financeiro, o dashboard não calcula impacto monetário e direciona para validação no módulo dono.
- Sem `entityId` específico, o CTA abre o módulo responsável em vez de criar link de detalhe fictício.

## CTAs permitidos e preservados

Os CTAs levam para módulos existentes: O.S., Financeiro, Agendamentos, WhatsApp, Timeline, Governança e Clientes. Eles apenas navegam para contexto real; não disparam cobrança, WhatsApp, automação ou alteração de status automática.

## Diferença para páginas específicas

O Dashboard prioriza e roteia decisões transversais. Clientes, Agendamentos, O.S., Financeiro, WhatsApp, Timeline e Governança continuam responsáveis por execução detalhada, filtros profundos, edição, automações existentes e histórico completo. Páginas específicas não devem duplicar o cockpit completo; devem receber o usuário já orientado pelo contexto do Dashboard.

## Limites preservados

Esta etapa não altera backend, API, Prisma, rotas, contratos multi-tenant, fontes de dados existentes ou `WhatsAppPage`. Lacunas de dados devem ser tratadas como gaps futuros de BFF/API, não como mock no frontend.

## Gaps futuros identificados

- Estado operacional canônico de governança/risk nem sempre aparece no contrato do `dashboard.kpis`.
- Conversões reais entre etapas do fluxo ainda dependem de payloads mais ricos; hoje o cockpit só aponta gargalos quando há alertas concretos.
- Responsável, prazo detalhado e entityId nem sempre vêm na `operationalQueue`; o dashboard usa fallback textual e CTA para módulo nesses casos.
- Tendências só aparecem quando `metrics.comparison` retorna percentuais; sem histórico suficiente, a UI declara a limitação.
