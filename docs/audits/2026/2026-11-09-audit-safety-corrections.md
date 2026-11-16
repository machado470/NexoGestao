# Correções de segurança operacional após auditoria — 2026-11-09

Base revisada: `524cbaf49193725ea7e75e8422db929e47ad626c` (main).

## Pessoas e acesso administrativo

PATCH e DELETE de Pessoas passam a usar a mesma validação de desativação. Ordens OPEN, ASSIGNED e IN_PROGRESS impedem a operação. A mudança de atividade é serializada pelo mesmo lock de Organization usado na administração de membros, e o ator autenticado é revalidado após adquirir o lock. A própria pessoa de um administrador não pode ser desativada por ele, e a organização deve preservar pelo menos um administrador ativo com pessoa ativa.

Mudança de atividade, AuditEvent e TimelineEvent são persistidos na mesma transação. Uma falha de evidência desfaz a mudança inteira. A autoria vem da sessão, inclusive na edição. A reativação da pessoa não altera User.active nem User.role.

## Cobranças e pagamentos

Cobranças PAID rejeitam mudanças em amountCents; o valor já registrado pode acompanhar uma edição de observações sem bloquear o salvamento. O pagamento só altera o estado da cobrança quando amountCents e updatedAt ainda correspondem ao registro validado. Se uma edição concorrente vencer, o pagamento recebe conflito e nenhum Payment é criado. A repetição de um pagamento já confirmado continua seguindo a resposta idempotente existente.

## Automações

O schema atual não possui AutomationRule/AutomationExecution nem um executor funcional de ações genéricas. O consumo de execute-action passa a falhar explicitamente, sem reenfileirar a mesma ação ou simular sucesso. O caminho de despacho também recusa enfileiramento sem executor. Esta correção não implementa nem habilita o mecanismo de automações; a execução de triggers continua retornando disabled no schema atual.

## Validação

- Regressões direcionadas: 49 testes aprovados em quatro suítes.
- PostgreSQL descartável real: 13 testes aprovados em duas suítes, incluindo administração de membros já existente e três novos casos de concorrência e rollback. A corrida de pagamento usa uma barreira de leitura dentro da transação e uma gravação concorrente por outra conexão, sem simular o banco.
- Typecheck e build da API: aprovados.
- Suíte unitária completa da API: 143 suítes e 851 testes aprovados após os ajustes da revisão.
- git diff --check sem erros.

Uma primeira execução da suíte completa a partir da raiz encontrou uma expectativa preexistente de diretório de trabalho em people-capacity-schema.spec.ts; a validação final é executada em apps/api, como no comando oficial. A primeira versão do teste novo de concorrência omitia o acesso inicial à cobrança no adaptador de barreira; o adaptador foi corrigido e a execução real passou.

Não há migration, alteração de frontend, publicação ou acesso a dados de produção. O container PostgreSQL temporário foi encerrado e removido após a validação.

## Ajustes após revisão do PR #1027

A revisão identificou que o editor de observações envia o valor existente mesmo em cobranças pagas. A validação passou a comparar com o valor persistido, preservando essa edição sem permitir mudança monetária.

O webhook de mudança de atividade voltou a ser despachado por dispatchPersistedEventWebhook após o commit, usando o ID do evento persistido. A evidência permanece transacional, e falhas de commit não disparam entregas. Testes unitários cobrem PATCH, DELETE e falha no commit; o teste com PostgreSQL confirma que a entrega enxerga a pessoa desativada e o evento já persistido por outra conexão.
