# Runbook canônico de produção

## Estado e autoridade

- `REPOSITORY_DEPLOY_AUTHORITY = COMPOSE`: Compose é a autoridade estática versionada.
- `ACTUAL_PRODUCTION_PLATFORM = NOT_VERIFIED`: Railway permanece alvo concorrente/não canônico; `railway.json` não prova a plataforma real.
- `DR_OWNER = NOT_ASSIGNED`; RPO = `NOT_DEFINED`; RTO = `NOT_DEFINED`.
- backup/restore local = `PROVED_IN_DISPOSABLE_INFRASTRUCTURE`.
- runner agendado = `IMPLEMENTED_NOT_PROVED_IN_PRODUCTION`; cron instalado = `NOT_PROVED`.
- offsite = `IMPLEMENTED_NOT_PROVED`; entrega de alerta = `MISSING`.

## Pré-deploy, deploy, migration e smoke

1. Designar aprovadores e janela (`DECISION_REQUIRED`), confirmar rollback e preservar backup anterior.
2. Validar fora do Git as variáveis exigidas. Renderizar e revisar `docker compose config`.
3. Executar o fluxo Compose aprovado (`NOT_PROVED` na produção real).
4. Executar `pnpm prisma:migrate:deploy` uma vez, com configuração explícita; nunca alterar migrations aplicadas.
5. Consultar health checks e executar smoke não destrutivo. Critérios reais são `DECISION_REQUIRED`.

## Backup manual e agendado

O único motor é `scripts/backup-db.sh`. Ele detém o lock, cria dump/checksum, valida integridade e aplica `RETENTION_DAYS`; retenção não é RPO. Use `--upload` somente com bucket e AWS CLI aprovados.

Para agendar, crie fora do Git um arquivo modo `0600` baseado no exemplo sanitizado. `BACKUP_MODE` aceita `local` ou `local_and_offsite`; o segundo exige bucket e AWS CLI e falha quando upload falha. Renderize o template cron com usuário, raiz absoluta do checkout e arquivo de ambiente. Instalação e execução do cron não integram esta onda.

Execução equivalente manual: `NEXO_BACKUP_ENV_FILE=/path/outside/git/backup-production.env scripts/run-production-backup.sh`. Não existe leitura implícita de `.env`.

## Consulta factual e incidente

Execute `BACKUP_STATE_DIR=/configured/state scripts/backup-status.sh`. O runner grava atomicamente `last-attempt.json`, `last-success.json` e `last-failure.json`, com permissões restritas e sem credenciais. `offsiteUpload=skipped` não significa sucesso offsite.

Em falha, preserve logs e state, use o `reasonCode`, não trate upload ausente como sucesso e escale ao papel DR owner. Alerting externo é `MISSING`.

### Checagem local para um monitor

A consulta sem argumentos mantém o JSON factual anterior. Para uma checagem automatizável, defina explicitamente a idade máxima aprovada pelo responsável:

```bash
BACKUP_STATE_DIR=/configured/state scripts/backup-status.sh --check \
  --max-age-seconds "$APPROVED_BACKUP_MAX_AGE_SECONDS" --require-offsite
```

`APPROVED_BACKUP_MAX_AGE_SECONDS` deve ser um inteiro positivo definido fora do Git. Não há default e isso não define RPO/RTO. Omita `--require-offsite` somente quando a checagem pretendida for local. Não se instala monitor, cron nem alerta por executar essa consulta.

O modo `--check` lê `last-attempt.json` e `last-success.json`, exige snapshots coerentes, sucesso local e datas válidas/não futuras. Retorna JSON sanitizado (sem conteúdo bruto ou caminho de artefato) e código 0 somente se a checagem passar; código 1 significa estado insuficiente/falho/vencido; código 64 indica configuração/argumentos inválidos. O modo factual sem argumentos continua retornando o estado como antes, inclusive quando o último backup falhou.

| reasonCode | Interpretação |
| --- | --- |
| `BACKUP_CHECK_PASSED` | Estado registrado atende aos critérios informados |
| `BACKUP_ATTEMPT_UNAVAILABLE` | Última tentativa ausente, ilegível ou inválida |
| `BACKUP_LAST_ATTEMPT_FAILED` | Última tentativa falhou, mesmo que exista sucesso anterior |
| `BACKUP_SUCCESS_UNAVAILABLE` | Snapshot de sucesso ausente, ilegível ou inválido |
| `BACKUP_STATE_INCONSISTENT` | Snapshots não correspondem à mesma execução/resultado |
| `BACKUP_STALE` | Último sucesso excede a idade máxima informada |
| `BACKUP_OFFSITE_UNCONFIRMED` | Upload não confirmado no estado e exigido na checagem |

A checagem avalia **o estado registrado pelo runner**, não verifica arquivo remoto, checksum, restauração ou recebimento de alerta. `offsiteUpload=uploaded` não comprova durabilidade nem acesso ao bucket atual. Um monitor externo ainda precisa ser configurado, ter responsável e comprovar entrega; AU12 permanece parcial.


## Restore, migration recovery, rollback e cleanup

Restore em produção exige aprovação do DR owner, alvo confirmado, artefato e sidecar baixados, checksum pós-download, janela e rollback. Esses controles são `NOT_PROVED`; `scripts/restore-db.sh` bloqueia produção e não deve ser contornado. Drills ocorrem somente em infraestrutura descartável.

Em migration falha, interrompa rollout, preserve logs/banco, não edite histórico aplicado e escolha roll-forward ou procedimento Prisma aprovado (`DECISION_REQUIRED`). Para rollback da aplicação, reimplante revisão/imagem aprovada após verificar compatibilidade da migration (`NOT_PROVED`). No cleanup, remova somente recursos descartáveis identificados; artefatos reais obedecem à política aprovada.

## Responsabilidades de DR e prova offsite pendente

O DR owner ainda não atribuído deverá aprovar restore, verificar backup, responder à falha, executar drill periódico, aprovar RPO/RTO e manter acesso controlado ao offsite.

Uma prova futura deve verificar bucket real, TLS, criptografia em repouso, versionamento, lifecycle, retenção, IAM mínimo, upload de dump e checksum, download, checksum pós-download e restore do artefato baixado. Defaults AWS não provam esses controles.

## Base executável de Compose (sem destino real)

Siga a seção “Base Compose reproduzível” em `deployment.md` para configuração,
TLS, build e comando one-shot `migrate`. `AUTO_MIGRATE=0` e `SEED_MODE` vazio
são impostos no serviço API. O startup verifica banco e schema, mas não os altera.
A prova `scripts/smoke-production-compose.sh` usa somente recursos descartáveis.

Antes de qualquer execução real, ainda faltam: provedor/servidor/domínio,
identificação do daemon e dos volumes existentes, responsáveis, backup aprovado,
janela, firewall/TLS e critérios de smoke/rollback. O CI valida a base Compose;
não executa publicação, migrations remotas ou promoção real.
