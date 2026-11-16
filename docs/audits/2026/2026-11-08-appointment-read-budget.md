# Orçamento de consultas da Agenda — 2026-11-08

## Correção

A lista usada por Agenda/Calendário e o detalhe do agendamento herdavam o limite global de dez requisições por minuto. Navegação entre telas, filtros e reconsultas após edição compartilhavam rapidamente esse orçamento e provocavam HTTP 429 durante um fluxo legítimo.

Somente `GET /appointments` e `GET /appointments/:id` agora têm orçamento explícito de 120 requisições por minuto, cada um sob a política de identificação/origem existente no Throttler. Variar filtros, páginas ou identificadores não cria um orçamento novo dentro do mesmo handler. O limite continua finito e devolve 429 ao excedê-lo.

Não foram alterados os limites globais, a autenticação, os papéis, quotas do plano, criação ou edição de agendamentos, nem o endpoint de login. Não houve mudança de schema, migration ou integração externa.

## Testes

Sete testes HTTP adicionais executam os controllers e o Throttler reais, com serviços de domínio e autenticação substituídos por doubles. Verificam:

- 120 leituras de lista aceitas e a 121ª bloqueada, mesmo variando os parâmetros;
- 120 leituras de detalhe aceitas e a 121ª bloqueada, mesmo mudando o identificador;
- criação e edição com os limites anteriores, sem compartilhar contadores com leitura;
- manutenção de VIEWER em somente leitura;
- manutenção do comportamento efetivo do login e de uma rota GET não relacionada.

A regressão específica com a consulta de sessão também foi executada (nove casos no total). A prova no navegador usa a aplicação completa com o limitador habilitado; não utiliza o modo de desenvolvimento que o desabilita.

## Resultados

- Suíte API completa: 723 testes aprovados; 62 casos opt-in permaneceram ignorados na execução padrão.
- Build e checagem de tipos da API: aprovados.
- Chromium/Playwright com API, BFF e PostgreSQL reais locais: seis cenários de criação, edição e remarcação passaram, em America/Sao_Paulo e UTC, sem reiniciar a API entre os fusos.
- O log HTTP confirmou 14 consultas de agendamentos, todas com status 200, e nenhum HTTP 429 em toda a sequência. O roteiro ultrapassou o orçamento anterior de dez consultas na mesma instância.
- As verificações no banco confirmaram preservação dos horários não editados e conversão correta dos horários alterados/criados.

A pendência de orçamento de leitura registrada em `2026-11-08-local-datetime-editing.md` fica atendida para lista e detalhe de agendamentos. Outros endpoints mantêm suas políticas existentes.

Nenhuma integração externa foi acionada. Os processos de API/BFF e o projeto Compose descartável foram encerrados após a validação.
