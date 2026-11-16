# Vencimentos no fuso da organização — 2026-11-09

Base: main `45bcfca972810abe03267690a26f0b05fad5efa3`.

## Falha e comportamento final

A rotina financeira calculava o início/fim do dia com setHours no fuso do processo. Às 01:30 UTC de 10/11, por exemplo, uma organização em America/Sao_Paulo ainda está em 09/11; a rotina anterior podia marcar cobranças desse dia como vencidas antes da meia-noite local.

A avaliação passa a consultar Organization.timezone e calcular os instantes UTC que delimitam o dia civil nessa zona. Lembretes do dia usam `[início do dia, início do próximo dia)`; transições para OVERDUE usam vencimento estritamente anterior ao início do dia. O mesmo limite é repetido na atualização condicional e transacional, preservando a proteção contra concorrência.

O cálculo usa Intl com zona IANA explícita e pesquisa os limites do calendário, sem assumir duração de 24 horas ou um offset fixo. Contempla dias de 23/25 horas, mudança de meia hora, offsets de 45 minutos, salto da meia-noite e virada de mês/ano. Nenhuma dependência adicional foi instalada.

Organização ausente ou fuso inválido interrompe a rotina antes de consultar/mutar cobranças. Não há fallback silencioso para o relógio do servidor. Os eventos registram o fuso usado e o instante de avaliação. As datas exibidas no texto de cobranças e lembretes WhatsApp usam o mesmo fuso da organização.

## Verificação

- API: 154 suítes e 948 testes unitários aprovados.
- PostgreSQL/Redis: 16 testes aprovados em três suítes, incluindo quatro novos casos de virada local/DST/configuração inválida e regressões existentes de integridade financeira e worker.
- Casos unitários de calendário: UTC, São Paulo, Nova York, Kiritimati, Pago Pago, Kathmandu, Lord Howe e Apia; horários de verão e meia-noite inexistente em São Paulo em 2018.
- Independência do timezone do servidor verificada alternando TZ no teste.
- PostgreSQL real: mesma hora UTC produz PENDING para a organização cujo dia ainda não virou e OVERDUE para outra; cobranças no limite exato do próximo dia permanecem pendentes; reexecução não duplica eventos.
- Typecheck da API, build dos três workspaces, validador operacional web e git diff --check aprovados.

## Limites

Não há migration nem reescrita de dueDate. O contrato continua usando o instante persistido e interpretando seu dia civil no fuso da organização. Esta entrega não altera os formulários de entrada de datas, não cancela mensagens já enfileiradas no provedor e não modifica a deduplicação existente de lembretes. Um fuso alterado durante uma execução vale para as próximas avaliações; a metadata do evento registra o snapshot usado naquela execução.

Os testes usam dados sintéticos, relógio controlado e adaptador WhatsApp sem envio externo. Não houve acesso a produção ou alteração de hospedagem.
