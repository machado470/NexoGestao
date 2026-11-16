# Datas locais em agendamentos e O.S. — 2026-11-08

## Problemas corrigidos

O editor de agendamentos extraía data/hora com `toISOString().slice(...)`, mas reconstruía a data como horário local. Em um navegador no fuso America/Sao_Paulo, um instante UTC passava a ser exibido três horas à frente no formulário e podia ser deslocado ao salvar uma simples observação. A criação compartilhada também cortava a string ISO original sem considerar seu offset.

O editor de O.S. tinha o mesmo problema de preenchimento. Além disso, criação e edição enviavam os valores de `datetime-local` sem offset, enquanto o BFF exige timestamps UTC explícitos; preencher programação/vencimento podia provocar rejeição do contrato.

Os quatro formulários agora usam uma conversão comum: controles são preenchidos com os componentes locais do navegador e o transporte envia ISO UTC. Quando o valor local não foi alterado, o instante original é preservado, inclusive segundos/milissegundos e o offset implícito de uma hora repetida por mudança de horário de verão. Datas inválidas e horários locais inexistentes em transições de DST são rejeitados antes de enviar a operação.

O escopo é o relógio local do navegador, consistente com os controles `date`, `time` e `datetime-local` e com a apresentação existente. Não foi implementado um seletor de fuso nem uma mudança para interpretar esses controles pelo fuso cadastrado na organização. Regras de duração, estados operacionais e contratos REST/BFF não foram flexibilizados.

## Testes automatizados

Quinze testes de conversão são executados em processos isolados com TZ explícito: America/Sao_Paulo, UTC, Asia/Kolkata, Pacific/Kiritimati e America/New_York. Cobrem mudança de dia, fuso de meia hora, round-trip exato, horário inexistente/repetido e entradas inválidas.

Quatro testes adicionais do BFF comprovam aceitação/encaminhamento dos timestamps UTC em criação/edição de O.S. e rejeição de timestamps locais sem offset. A suíte web completa passou com 631 testes; build web, TypeScript e lint operacional também passaram. A API não teve seu código alterado nesta entrega.

## Verificação com navegador e banco locais

Com Chromium/Playwright no fuso America/Sao_Paulo e API/BFF/PostgreSQL reais locais:

1. Um agendamento das 12h30 UTC foi apresentado como 9h30; salvar somente a observação preservou início/fim e milissegundos no banco.
2. Remarcar explicitamente para 10h45 gravou 13h45 UTC e manteve a duração.
3. Editar somente a descrição da O.S. preservou programação e vencimento exatos no banco.
4. Criar O.S. com programação 8h15 e vencimento 15h30 gravou 11h15/18h30 UTC e passou pelo contrato estrito do BFF.
5. Criar agendamento pelo Calendário às 11h20 gravou 14h20 UTC.

6. Em navegador UTC, o mesmo agendamento foi apresentado como 13h45; alterar somente a observação preservou início/fim no banco.

A checagem do mesmo agendamento em navegador UTC foi isolada em uma instância nova da API para não compartilhar os contadores de requisições das várias tentativas de teste. Os limites permaneceram habilitados. A execução concentrada dos cenários atingiu o limite existente de leituras de agendamentos e causou 429; essa limitação de sequências rápidas de edição/refetch permanece registrada para uma próxima revisão do orçamento de leitura, sem alteração nesta entrega.

Nenhum provedor externo foi acionado. Os dados e serviços usados na prova são descartáveis e separados dos dados de aplicação.

Os processos de API/BFF e o projeto Compose descartável foram encerrados ao final da validação.
