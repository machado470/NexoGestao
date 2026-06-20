# DEV_RULES

Regras obrigatórias para o boot local do NexoGestao.

1. Não adicionar novos scripts de desenvolvimento sem necessidade real.
2. Não adicionar novas flags de boot sem revisão técnica formal.
3. Não aumentar a complexidade do boot local com fallback oculto ou auto-decisões.
4. O fluxo local deve priorizar simplicidade, previsibilidade e estabilidade.
5. `scripts/dev-full.sh` é estável: apenas correções críticas futuras.
6. Integrações opcionais nunca podem bloquear o boot local e devem logar como `[OPTIONAL]`.

## Boot local suportado

- Use `pnpm dev:full` para subir o ambiente local completo.
- O script sobe somente `postgres` e `redis` pelo Docker Compose; a API e a WEB rodam via `pnpm` na máquina local.
- O container `nexogestao_api` não faz parte do fluxo `dev:full`.
- Se houver conflito nas portas 3000/3010, rode `pnpm dev:ports` para diagnosticar.
- Para limpar apenas processos antigos do próprio NexoGestão nas portas da API/WEB, rode exatamente: `NEXO_DEV_KILL_PORTS=1 pnpm dev:full`.
- Processos externos nas portas da API/WEB não devem ser encerrados automaticamente.
- A variável antiga `NEXO_KILL_STALE_DEV_PROCESSES=1` continua aceita apenas por compatibilidade; prefira `NEXO_DEV_KILL_PORTS=1`.
- Para recriar a infraestrutura local, rode `pnpm dev:reset`; ele usa `NEXO_DEV_RESET=1 NEXO_DEV_KILL_PORTS=1 ./scripts/dev-full.sh`.

## Seed local de desenvolvimento

- Por padrão, `pnpm dev:full` não roda seed.
- Em banco vazio, rode exatamente `NEXO_DEV_SEED=1 pnpm dev:full` para criar usuários de desenvolvimento.
- Variáveis passadas na linha de comando têm precedência sobre `.env`; portanto `NEXO_DEV_SEED=1 pnpm dev:full` habilita o seed mesmo que o `.env` tenha `NEXO_DEV_SEED=0`.
- Sem `NEXO_DEV_SEED=1`, o script informa que banco vazio não terá login disponível.
- O modo padrão do seed Prisma/dev local é `pilot` (`SEED_MODE=pilot`).
- Credenciais locais padrão do seed piloto:
  - Admin: `admin.piloto@nexogestao.local` / `Admin123!`
  - Operação: `operador.piloto@nexogestao.local` / `Piloto@Operador123`
  - Financeiro: `financeiro.piloto@nexogestao.local` / `Piloto@Finance123`
- Credencial do seed básico (`SEED_MODE=basic`): `admin@nexogestao.local` / `123456`.
- Com `NEXO_DEV_SEED=1`, o `dev:full` imprime as credenciais efetivamente aplicadas ao final do seed.
- Essas credenciais são somente para desenvolvimento local/piloto e não devem ser usadas em produção.
