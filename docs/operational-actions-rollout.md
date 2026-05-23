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
   - `pnpm --filter ./apps/api prisma migrate deploy`
2. **Gerar Prisma Client com schema atual**
   - `pnpm prisma generate || pnpm --filter ./apps/api prisma generate`
3. **Build e deploy da API**
   - `pnpm -s build`
   - subir nova versão da aplicação
4. **Validar health e fluxo operational-actions**
   - verificar endpoint de health
   - executar fluxo real de request/execute/cancel
5. **Pós-check de banco**
   - confirmar enum com `EXECUTING`, coluna `logicalKey` e índice parcial presentes.

## Riscos conhecidos
- App nova subir antes de migration: falhas por enum/coluna ausentes.
- Prisma Client stale: código espera `EXECUTING`/`logicalKey`, client antigo pode quebrar tipagem/query.
- Pipeline sem `migrate deploy`: drift entre código e banco.
- Ambiente com migration parcialmente aplicada.

## Validação pós-deploy (checklist curto)
- `pnpm --filter ./apps/api prisma migrate status`
- `pnpm --filter ./apps/api prisma migrate deploy` (idempotente: não deve aplicar nada extra inesperado)
- smoke test do módulo operational-actions:
  - criar execução (`REQUESTED`)
  - iniciar execução (`EXECUTING`)
  - finalizar (`EXECUTED`) ou erro (`FAILED`)
- conferir logs sem erro de enum/coluna/index.

## Comandos de verificação
```bash
# prisma + build + testes
pnpm prisma generate || pnpm --filter ./apps/api prisma generate
pnpm --filter ./apps/api prisma migrate deploy
pnpm -r typecheck
pnpm -s build
pnpm test
pnpm --filter ./apps/api test

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
  - rodar `prisma generate` no mesmo commit/schema do deploy.
