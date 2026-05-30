# Dashboard executivo — gaps de leitura operacional

Este lote transforma o dashboard em centro de decisão sem criar um novo read model e sem completar lacunas com estimativas no frontend.

## Dados reaproveitados

- `/dashboard/metrics`: clientes, O.S., receita, cobranças, pagamentos recebidos via `Payment` e comparação semanal equivalente com a semana anterior.
- `/dashboard/alerts`: O.S. atrasadas, cobranças vencidas, agenda do dia, clientes com pendências, O.S. concluídas sem cobrança e fila transversal leve com até 6 itens reais.
- `/internal/operational-signals?limit=8`: sinais operacionais priorizados.
- `/internal/operational-signals/next-best-action`: Próxima Melhor Ação real.
- `nexo.whatsapp.listPendingApprovals`: entrada compacta para aprovações pendentes.

## Gaps mantidos explícitos

1. O volume final do fluxo usa `Payment.paidAt` como fonte oficial e não converte cobrança `PAID` em pagamento. Cenários legados sem entidade `Payment` permanecem honestamente como zero recebido no período; não há fallback por cobrança paga.
2. A comparação operacional usa a semana corrente até agora contra a janela equivalente da semana anterior. Quando a base anterior é zero, o contrato retorna `null` e o Pulso informa ausência de base histórica suficiente.
3. A fila transversal leve agora sai de `/dashboard/alerts`, priorizando até 6 itens reais entre O.S. atrasadas, cobranças vencidas, agendamentos `SCHEDULED` do dia e mensagens falhando. Se o produto precisar priorização transversal mais sofisticada, o próximo lote pode avaliar um read model operacional dedicado.
4. O endpoint de agenda do dashboard permite identificar agendamentos `SCHEDULED` ainda não confirmados no dia, mas não expõe uma fila transversal completa de confirmações pendentes futuras.
5. Clientes aguardando resposta continuam disponíveis apenas como agregado em `whatsappSignals.customersNoResponse`; o contrato atual não expõe itens individuais para a fila curta.
