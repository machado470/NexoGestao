# Dashboard executivo — gaps de leitura operacional

Este lote transforma o dashboard em centro de decisão sem criar um novo read model e sem completar lacunas com estimativas no frontend.

## Dados reaproveitados

- `/dashboard/metrics`: clientes, O.S., receita, cobranças e sinais agregados de WhatsApp.
- `/dashboard/alerts`: O.S. atrasadas, cobranças vencidas, agenda do dia, clientes com pendências e O.S. concluídas sem cobrança.
- `/internal/operational-signals?limit=8`: sinais operacionais priorizados.
- `/internal/operational-signals/next-best-action`: Próxima Melhor Ação real.
- `nexo.whatsapp.listPendingApprovals`: entrada compacta para aprovações pendentes.

## Gaps mantidos explícitos

1. O backend atual não expõe quantidade de pagamentos para completar o volume final do fluxo `Cliente → Agendamento → O.S. → Cobrança → Pagamento`. O dashboard mostra `—` e direciona para pagamentos.
2. O backend atual não expõe comparação entre períodos para uma tendência operacional confiável. O Pulso da operação informa que a tendência histórica está indisponível.
3. A fila curta é montada no frontend a partir dos itens já retornados por alertas e sinais. Se o produto precisar priorização transversal mais sofisticada, o próximo lote pode avaliar um read model operacional dedicado.
4. O endpoint de agenda do dashboard permite identificar agendamentos `SCHEDULED` ainda não confirmados no dia, mas não expõe uma fila transversal completa de confirmações pendentes futuras.
5. Clientes aguardando resposta continuam disponíveis apenas como agregado em `whatsappSignals.customersNoResponse`; o contrato atual não expõe itens individuais para a fila curta.
