# Pessoas — capacidade operacional e gaps conhecidos

## Entregue

- A tela Pessoas usa `GET /people/operational-summary`, sempre limitado ao tenant autenticado por `orgId`.
- A carga atual continua baseada em atribuições reais: O.S. abertas, O.S. atrasadas, agendamentos de hoje, próximos agendamentos e última atividade da timeline.
- A capacidade planejada agora é configurável por pessoa: capacidade diária de O.S., capacidade diária de agendamentos e nota operacional opcional.
- A comparação expõe percentuais de uso e `capacityStatus` sem alterar o `loadStatus` operacional existente.
- O modal estável de edição de pessoa permite ajustar os três campos mínimos de capacidade.
- Indisponibilidades temporárias simples agora podem ser registradas por pessoa com início, fim e motivo opcional. O resumo operacional expõe disponibilidade atual e próxima exceção sem alterar `capacityStatus`.
- Os fluxos manuais estáveis de atribuição de agendamentos e O.S. exibem alertas passivos quando a pessoa selecionada está indisponível, ficará indisponível em breve, excedeu a capacidade planejada ou apresenta carga operacional alta.

## Semântica importante

Capacidade não é produtividade. A capacidade responde quanto a pessoa aguenta hoje segundo o planejamento operacional. O produto ainda não mede quanto a pessoa entrega bem e não cria score de produtividade.

Quando uma capacidade estiver ausente ou for zero em um registro legado, o percentual correspondente fica indisponível e o status consolidado é conservador (`AT_CAPACITY`), em vez de presumir folga operacional.

## Gaps intencionais

- Ainda não existem turnos, escalas completas ou calendário de jornada.
- A indisponibilidade temporária não modela férias complexas, recorrência ou políticas de RH.
- Ainda não existem especialidades ou compatibilidade entre responsável e tipo de serviço.
- Os alertas de atribuição não bloqueiam o salvamento: a decisão operacional continua humana.
- Ainda não existe redistribuição automática ou recomendação automática de atribuição.
- Ainda não existe score de produtividade, ranking individual ou avaliação de desempenho.
