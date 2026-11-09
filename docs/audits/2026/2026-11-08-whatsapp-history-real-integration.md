# Histórico WhatsApp e prova com infraestrutura real — 2026-11-08

## Problemas corrigidos

A automação registrava eventos com sufixo `SENT` logo após o enfileiramento. Agora registra `WHATSAPP_MESSAGE_QUEUED` apenas quando uma mensagem nova foi criada. Replays idempotentes não duplicam esse histórico. A confirmação do worker ou callback continua emitindo `MESSAGE_SENT` e passa a emitir também os eventos específicos de confirmação de agenda, lembrete de pagamento e confirmação de pagamento, no mesmo ponto em que o envio é confirmado.

O inbox do frontend retorna `{ items, nextCursor }`, mas a atualização após envio manual/template tentava tratar a resposta como um array. O contato virtual agora é promovido usando o envelope canônico. O feedback do template informa entrada na fila, sem afirmar envio confirmado. Timeline e apresentação compartilhada têm rótulo para a mensagem enfileirada.

A primeira execução do teste canônico com infraestrutura real falhou no boot: `WhatsAppModule` importava `HealthModule`, que importava Dashboard → Governance → Finance → WhatsApp. O serviço compartilhado de métricas foi movido para `WhatsAppObservabilityModule`, sem dependências de features. Health e WhatsApp importam o mesmo módulo singleton, eliminando o ciclo sem criar instâncias duplicadas dos contadores.

## Infraestrutura real e resultados

Foram iniciados PostgreSQL 15 e Redis 7 descartáveis em um projeto Compose dedicado, com portas locais 15432/16379 e banco vazio separado. Todas as migrations foram aplicadas sem alterações. Não foram utilizados dados ou volumes da aplicação. Os containers e a rede de teste são removidos após a validação; os dados PostgreSQL estavam em tmpfs.

Após a correção do boot:

- Teste canônico completo: 1 aprovado, com aplicação Nest real, PostgreSQL, Redis, transições operacionais e isolamento entre organizações.
- Nova suíte de convites em PostgreSQL: 5 aprovados, cobrindo substituição do link, revogação repetida, dois aceites simultâneos, aceite concorrente com revogação e falha de reenvio após revogação concorrente.

Os testes reais de convite usam bcrypt e transações Prisma reais; somente e-mail e criação de sessão usam doubles. Portanto comprovam persistência/concorrência, sem comprovar entrega externa de e-mail. O teste canônico usa provedor WhatsApp mock; não comprova integração com Meta/Z-API.

A regressão padrão também passou: 686 testes API (52 opt-in ignorados nesta execução padrão), 593 testes web, build e checagem de tipos dos três pacotes e lint operacional web. Os seis testes reais descritos acima foram executados separadamente com opt-in habilitado.

## Pendências

Permanecem validações com provedores externos de e-mail, WhatsApp e Stripe, além das outras suítes de integração opt-in. Esta rodada executou as duas suítes reais descritas acima; não afirma aprovação de todas as integrações existentes.
