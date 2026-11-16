# Alinhamento entre schema Prisma e migrações — 2026-11-09

Base: main `af923d26bafe24c845815b6677f9557ef403ac2c`.

## Problema

A comparação de um PostgreSQL recriado somente pelas migrações com o schema Prisma produzia 48 linhas de SQL. O diff sugeria alterações de tipos e defaults, remoção de índice de autenticação e troca de chave estrangeira, além de renomeações de índices. Essa diferença já existia antes das correções dos nove gaps.

## Correção

O schema passa a representar os contratos persistidos pelas migrações:

- Expense.occurredAt permanece TIMESTAMPTZ(6), preservando instantes e offsets.
- OperationalOutboxEvent.id permanece UUID com default gen_random_uuid(). updatedAt preserva seu default de banco e a atualização pelo cliente.
- WhatsAppConversation.provider permanece obrigatório, com default mock. Isso descreve o estado já existente do banco; não habilita providers mock em produção nem altera a política de envio.
- Defaults de updatedAt nas tabelas WhatsApp são mantidos.
- WhatsAppMessage.customer mantém ON DELETE RESTRICT, já presente no histórico; a relação não é convertida para SET NULL.
- O índice de emailVerifyTokenHash e o índice histórico de ações operacionais são declarados no schema.
- Nomes de índices truncados historicamente pelo PostgreSQL são explicitados com map; não há renomeações no banco.

A nova migração `20261109180000_align_operational_query_indexes` apenas acrescenta os índices de consulta que estavam declarados no Prisma, mas ausentes no banco: ações por tipo de entidade e mensagens WhatsApp por status/data. Não altera colunas, defaults, chaves ou registros. A criação usa o mecanismo padrão de índices, dentro de transação; em bases grandes, considerar bloqueio de escritas e duração na janela de aplicação.

## Prevenção

`pnpm prisma:check:drift` compara o banco definido por DATABASE_URL com o datamodel e falha se houver diferença (o Prisma usa código 2 para sinalizá-la). É somente leitura e exige banco acessível e migrado. O CI executa o comando imediatamente após aplicar as migrações no banco descartável, antes de typecheck e testes.

## Verificação

- Banco vazio: todas as migrações aplicadas e diff final sem diferenças.
- Upgrade da main anterior: despesas, eventos outbox e conversas sintéticas criados antes da nova migração mantiveram valores, IDs e timestamps exatamente iguais após ela. Diff final sem diferenças.
- Prova do guard: remover um índice somente no banco descartável fez o comando retornar 2; restaurá-lo fez retornar 0.
- API: 150 suítes e 913 testes unitários aprovados; typecheck aprovado.
- PostgreSQL: 15 casos aprovados, incluindo os três novos contratos de schema, nove regressões financeiras/migração e três casos existentes da outbox com dois workers.
- Build dos três workspaces e validador operacional web aprovados.
- Prisma validate e git diff --check aprovados.

Os testes novos verificam a leitura de UUIDs e timestamps gerados pelo banco, a preservação do instante da despesa entre fusos de sessão e o contrato do provider WhatsApp. Os testes existentes da outbox verificam claim concorrente, propriedade de locks e retry/falha com o cliente Prisma regenerado.

Não houve reset de banco, reescrita de migração anterior, acesso a produção ou alteração de hospedagem. Toda infraestrutura utilizada foi descartável. Esta entrega resolve a pendência de divergência registrada em `2026-11-09-nine-gap-corrections.md`.
