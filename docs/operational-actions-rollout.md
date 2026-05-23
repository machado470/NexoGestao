# Operational Actions — Rollout/Migration Seguro

## Arquitetura resumida
- Tabela central: `OperationalActionExecution`.
- Status materializado em enum PostgreSQL/Prisma: `REQUESTED`, `EXECUTING`, `EXECUTED`, `FAILED`, `CANCELED`.
- Idempotência por `logicalKey` + índice único parcial para `REQUESTED`.
- Concorrência protegida na API via transição atômica `REQUESTED -> EXECUTING` com `updateMany`.

## Dependências de migration (ordem obrigatória)
1. `20260523120000_operational_action_execution_materialized_state`
   - cria enum inicial (sem `EXECUTING`) e tabela `OperationalActionExecution`.
2. `20260523170000_operational_actions_idempotency`
   - `ALTER TYPE ... ADD VALUE IF NOT EXISTS 'EXECUTING'`;
   - adiciona `logicalKey`;
   - faz backfill de `logicalKey` para dados legados;
   - define `logicalKey NOT NULL`;
   - cria índice de busca por `logicalKey`;
   - cria índice único parcial por `(orgId, logicalKey)` quando `status='REQUESTED'`.

## Ordem segura de deploy
1. **Aplicar migrations em produção**
   - `pnpm prisma:migrate:deploy`
2. **Gerar + validar Prisma Client com schema atual (fail-fast)**
   - `pnpm prisma:check`
3. **Executar preflight de CI local/esteira**
   - `pnpm ci:preflight`
4. **Validar health e fluxo operational-actions**
   - verificar endpoint de health
   - executar fluxo real de request/execute/cancel
5. **Pós-check de banco**
   - `pnpm db:smoke:operational-actions`
   - confirmar enum com `EXECUTING`, coluna `logicalKey` e índice parcial presentes.

## Riscos conhecidos
- App nova subir antes de migration: falhas por enum/coluna ausentes.
- Prisma Client stale: código espera `EXECUTING`/`logicalKey`, client antigo pode quebrar tipagem/query.
- Pipeline sem `migrate deploy`: drift entre código e banco.
- Ambiente com migration parcialmente aplicada.

## Validação pós-deploy (checklist curto)
- `pnpm --filter ./apps/api prisma migrate status`
- `pnpm prisma:migrate:deploy` (idempotente: não deve aplicar nada extra inesperado)
- `REQUIRE_DATABASE_SMOKE=1 pnpm db:smoke:operational-actions` (obrigar falha sem DATABASE_URL)
- smoke test do módulo operational-actions:
  - criar execução (`REQUESTED`)
  - iniciar execução (`EXECUTING`)
  - finalizar (`EXECUTED`) ou erro (`FAILED`)
- conferir logs sem erro de enum/coluna/index.

## Comandos de verificação
```bash
# ordem segura de validação (migrate -> generate/check -> typecheck/build/test)
pnpm prisma:migrate:deploy
pnpm prisma:check
pnpm -r typecheck
pnpm -s build
pnpm test
pnpm --filter ./apps/api test
pnpm db:smoke:operational-actions

# auditoria textual
rg -n "OperationalActionExecution|EXECUTING|logicalKey" prisma apps/api/src
rg -n "migrate deploy|prisma generate|prisma-cli" scripts package.json apps
rg -n "CREATE UNIQUE INDEX|logicalKey" prisma/migrations
```

## Troubleshooting comum
- **Erro de enum `EXECUTING` inexistente**
  - migration `20260523170000...` não aplicada.
- **Erro de coluna `logicalKey` inexistente**
  - migration `20260523170000...` não aplicada ou falhou antes de concluir.
- **Duplicidade inesperada em REQUESTED**
  - índice único parcial ausente; reaplicar `migrate deploy` e validar índice.
- **Client Prisma divergente**
  - rodar `pnpm prisma:check` para forçar `prisma validate` + `prisma generate`;
  - se o erro apontar client stale, garantir ordem: `migrate deploy` -> `prisma:check` -> `typecheck/build/test`.
- **Smoke de banco pulado localmente**
  - sem `DATABASE_URL`, o script avisa e segue sem quebrar;
  - em CI/CD crítico, use `REQUIRE_DATABASE_SMOKE=1` para falhar rápido se não houver conexão/alvo configurado.
