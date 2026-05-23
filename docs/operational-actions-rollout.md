# Rollout seguro de Operational Actions (Prisma + banco + startup)

## Objetivo
Garantir enforcement real para evitar rollout com drift entre código, Prisma Client e estrutura crítica de banco para `OperationalActionExecution`.

## Estruturas críticas protegidas
- Tabela `OperationalActionExecution`.
- Coluna `logicalKey`.
- Enum `OperationalActionExecutionStatus` com valor `EXECUTING`.
- Índice único parcial `OperationalActionExecution_unique_requested_per_key` para `status='REQUESTED'`.

## Enforcement obrigatório no CI
- O workflow `.github/workflows/ci.yml` roda `pnpm ci:preflight` antes de concluir build/test.
- `ci:preflight` já encadeia:
  - `pnpm prisma:check` (`prisma validate` + `prisma generate`);
  - typecheck/build/test.

## Enforcement de banco (secure-by-default em production)
O script `db:smoke:operational-actions` agora é **strict por default em `NODE_ENV=production`**.

Regras de ativação (`REQUIRE_DATABASE_SMOKE`):
- `1`: força modo estrito em qualquer ambiente.
- `0`: desativa modo estrito explicitamente (não recomendado em staging/prod).
- não definido: `1` em `production`, `0` em dev/test.

Comportamento:
- **dev/local sem `DATABASE_URL`**: smoke avisa e faz skip por padrão.
- **strict ativo** (`REQUIRE_DATABASE_SMOKE=1` efetivo): falha se `DATABASE_URL` estiver ausente ou se faltar estrutura crítica.

## Startup fail-fast da API (secure-by-default em production)
Ativação (`OPERATIONAL_ACTIONS_DB_STARTUP_CHECK`):
- `1`: força check em qualquer ambiente (exceto `NODE_ENV=test`).
- `0`: desativa explicitamente.
- não definido: habilita automaticamente em `NODE_ENV=production`, desabilita em dev/test.

Quando ativo (e `NODE_ENV != test`), a API valida no bootstrap:
- tabela `OperationalActionExecution`;
- coluna `logicalKey`;
- enum `EXECUTING`;
- índice único parcial.

Se algo faltar:
- registra erro claro de pré-condição;
- encerra startup (fail-fast).

Quando desativado:
- não bloqueia desenvolvimento/testes locais.

## Ordem final recomendada de rollout
1. `pnpm prisma:migrate:deploy`
2. `pnpm ci:preflight` (inclui `prisma:check` + typecheck/build/test)
3. `pnpm db:smoke:operational-actions` (em production já roda strict por padrão)
4. deploy da API (startup check habilita automaticamente em `NODE_ENV=production`)
5. health check pós-deploy

## Audit commands
```bash
rg -n "OperationalActionExecution|EXECUTING|logicalKey" prisma apps/api/src
rg -n "CREATE UNIQUE INDEX|logicalKey" prisma/migrations
rg -n "ci:preflight|prisma:check|db:smoke:operational-actions" .github package.json scripts docs
```

## Troubleshooting rápido
- Erro de enum `EXECUTING` inexistente:
  - revisar ordem de migrations e reaplicar `pnpm prisma:migrate:deploy`.
- Erro de coluna `logicalKey` inexistente:
  - confirmar migrações aplicadas no banco alvo.
- Erro de índice parcial ausente:
  - reaplicar migrations e validar `pg_indexes`.
- Prisma Client stale:
  - rodar `pnpm prisma:check` antes de typecheck/build/test.


## Overrides e risco operacional
- Use override (`REQUIRE_DATABASE_SMOKE=0` ou `OPERATIONAL_ACTIONS_DB_STARTUP_CHECK=0`) **apenas** para mitigação emergencial com janela curta.
- Risco ao desligar: aceitar deploy com drift de schema (tabela/coluna/enum/índice ausentes), causando falhas em runtime e perda de idempotência.
