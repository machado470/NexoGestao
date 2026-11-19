# Decisão comercial de cobertura do retorno

## Comportamento

ADMIN/MANAGER podem registrar e revisar a condição comercial da O.S. de retorno: aguardando avaliação, cobertura aprovada sem cobrança vinculada, ou serviço cobrável. Motivo de 10–1000 caracteres é obrigatório; autor/data vêm da sessão e do banco. STAFF/VIEWER consultam a decisão. Cada revisão registra Timeline nas duas ordens e Auditoria.

Novos retornos começam pendentes. Pendentes e cobertos não admitem cobrança vinculada a essa O.S. A decisão de serviço cobrável autoriza os fluxos existentes de cobrança manual/automática; registrar a decisão não cria cobrança. A original e seus pagamentos permanecem preservados. Cobranças avulsas do mesmo cliente não são bloqueadas por esta política.

Não há cancelamento, estorno ou crédito automático. Havendo qualquer cobrança vinculada, inclusive cancelada, não é permitido mudar para pendente/coberto nesta versão. Exige tratamento financeiro explícito futuro. O.S. cancelada não aceita nova decisão.

A decisão atualiza a O.S. e invalida links de aceite pendentes desse retorno pelo mecanismo existente de versão/data. Gerar novo link após alterar a condição; respostas já registradas permanecem preservadas. Sem envio automático de mensagens.

## Consistência e leitura operacional

Versão esperada impede revisão sobre dados desatualizados (409). Repetição imediata da mesma decisão/autor/motivo recupera o resultado sem duplicar histórico. Transação bloqueia a O.S. antes de decidir. Triggers no PostgreSQL usam o mesmo bloqueio tanto ao criar/vincular cobrança como ao mudar o tratamento, impedindo cobertura sem cobrança coexistir com cobrança vinculada em uma disputa concorrente.

As duas entradas financeiras validam a condição; conclusão normal e execução alternativa não geram cobrança para pendente/coberto. Se a cobertura vencer uma disputa após concluir a execução, o bloqueio financeiro não transforma a conclusão já gravada em falso erro. Outros erros continuam visíveis.

O.S. concluída com decisão pendente solicita avaliação comercial (P1), em vez de cobrança ausente. Coberta não gera risco por falta de cobrança. Filtros/contagens de O.S., clientes, dashboard, diagnóstico, risco, risco temporal e candidato de execução respeitam a condição. Atrasos de execução, responsável ausente e cobranças reais continuam seguindo suas regras. Snapshots históricos de risco/governança não são reescritos; novas apurações usam a condição atual.

O campo interno não é acrescentado aos DTOs estritos já estabelecidos de O.S.; aparece no domínio de retorno, mantendo compatibilidade durante deploy independente de API/web.

## Implantação

Migração `20261119180000_return_coverage` antes da nova API; `apps/api/railway.json` já configura `pnpm prisma:migrate:deploy` no pre-deploy. Conferir que o serviço usa esse arquivo. Retornos antigos com qualquer cobrança são preservados como cobráveis; sem cobrança passam a pendentes, sem alterar updatedAt no backfill. Ordens comuns permanecem STANDARD. Nenhuma escrita em produção foi feita nesta validação.

Rollback de aplicação não remove triggers: a proteção financeira permanece no banco. Não remover a migração ou converter decisões em massa sem revisar obrigações financeiras. Sem nova dependência externa.

## Validação local

- Cinco testes HTTP com Nest/PostgreSQL 17: funções/empresa/payload, ambas entradas financeiras, revisão e repetição concorrente, disputa cobrança/cobertura, guardas SQL nos dois sentidos e preservação de pagamento original.
- TypeScript API/web; suíte unitária API (187 suítes, 1297 testes aprovados; integrações opt-in separadas); contratos BFF.
- Auditoria Chromium em 320/390/1280 px: decisão, resposta perdida após commit, repetição sem duplicação, revisão, descarte, consulta STAFF/VIEWER e overflow; build Vite.
- Prisma migration diff sem divergência no banco isolado.

Banco obrigatório dos testes: `COVERAGE_TEST_DATABASE_URL=postgresql://nexo@127.0.0.1:55439/postgres`; arquivo `apps/api/src/service-orders/return-coverage.postgres.spec.ts`. Limpeza restrita às próprias fixtures. Browser: `scripts/audits/return-coverage.cjs` com Vite e harness local `commerce-local-api.ts`, `RETURNS_AUDIT=1`. Autenticação/contexto de browser e admissão comercial são simulados; decisões, histórico e banco são reais. Não valida Safari físico, assinatura comercial real ou produção.

## Próximos incrementos

Prazo/elegibilidade automática de garantia, orçamento de retorno com aprovação do cliente, materiais/custos, SLAs, encerramento de caso e ajustes financeiros com autorização própria. Esta entrega é decisão comercial manual, não motor completo de garantia nem assinatura digital.
