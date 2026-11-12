# Origem explícita do backup — 12/11/2026

Base `7626fd28`, branch `fix/backup-origem-explicita`, raiz `/workspace/NexoGestao`; início limpo, sem AGENTS.md aplicável. README/manifests, engine, runner, exemplos e testes consultados. PR #1056 integrado com os três checks aprovados.

## Achado e mudança

O engine atribuía implicitamente DB_CONTAINER=nexogestao_postgres_prod e preferia esse contêiner ao POSTGRES_HOST informado. Se um contêiner explicitamente escolhido estivesse parado, podia gerar dump pelo host alternativo. Isso permite backup da origem diferente da pretendida; não se demonstrou ocorrência em produção.

`scripts/backup-db.sh` agora usa contêiner somente quando configurado explicitamente e exige que esteja ativo, sem fallback. Sem contêiner exige POSTGRES_HOST. Seleção vazia por --container é inválida. No contêiner usa socket padrão/porta 5432; no host usa host/porta explícitos. Remove PGHOSTADDR/PGSERVICE/PGSERVICEFILE/PGOPTIONS para evitar roteamento herdado diferente da seleção. Mantidos usuário/banco configurados, formato do dump, checksum, lock, retenção e upload.

O exemplo de ambiente e o runbook orientam a migração de configurações antigas dependentes da descoberta/fallback. O CI inclui o novo `scripts/backup-source.test.mjs`.

## Evidências

- [Antes](backup-source-evidence/before.txt): reproduzidas seleção automática indevida, fallback de contêiner parado e origem ausente aceita. Docker/pg_dump simulados, sem banco.
- [Depois](backup-source-evidence/after.txt): **39 testes Node passaram**, incluindo seis novos cenários de origem. Host e contêiner explícitos funcionam; contêiner parado, origem ausente e argumento vazio param antes de dump; ambiente libpq não redireciona o host.
- [Regressão](backup-source-evidence/regression.txt): suíte shell existente passou. `bash -n scripts/backup-db.sh` e `git diff --check` passaram.
- [Drill real](backup-source-evidence/real-drill.txt): PostgreSQL 15 Alpine local (tag postgres:15 já disponível), projeto/porta/banco exclusivos. Migrations, tabela e registro fictícios, backup pela origem de contêiner explícita, remoção do registro de prova, restore, migrations/smoke e recuperação de synthetic-persisted passaram.

O drill encerrou container/rede, removeu diretório temporário próprio e preservou volumes. Não houve produção, credenciais reais ou contato com provedor/alerta. Não se repetiram build/tipos API/web, cujos fontes não mudaram.

## Limites

Escolher uma origem explicitamente não comprova que seja a origem produtiva aprovada; essa conferência continua operacional. Hosts/contêineres com socket/porta PostgreSQL fora do padrão precisam de procedimento específico, sem contornar a proteção de fallback. AU12 continua parcial por falta de responsável, objetivos e provas offsite/alerta; AU08/AU11 seguem parciais.
