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

## Enforcement obrigatório em staging/prod
Executar smoke de banco em modo estrito antes de subir a API:

```bash
REQUIRE_DATABASE_SMOKE=1 pnpm db:smoke:operational-actions
```

Comportamento:
- **dev/local sem `DATABASE_URL`**: smoke avisa e faz skip por padrão.
- **staging/prod com `REQUIRE_DATABASE_SMOKE=1`**: falha se `DATABASE_URL` estiver ausente ou se faltar qualquer estrutura crítica.

## Startup fail-fast da API
Ativar em staging/prod:

```bash
OPERATIONAL_ACTIONS_DB_STARTUP_CHECK=1
```

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
2. `pnpm prisma:check`
3. `REQUIRE_DATABASE_SMOKE=1 pnpm db:smoke:operational-actions`
4. deploy da API com `OPERATIONAL_ACTIONS_DB_STARTUP_CHECK=1`
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
