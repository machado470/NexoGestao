---
status: current
owner: nexogestao
last_reviewed: 2026-09-13
source_of_truth: true
---

# Fase 2.4 — auditoria de produção, backup e recovery

## Fechamento da Onda 2A

**Estado:** `CLOSED / PROVED_IN_DISPOSABLE_INFRASTRUCTURE`<br>
**Data da prova:** `2026-09-13`<br>
**Baseline:** `main` após PR #1016, merge `c3605c4aaf661771c580dee350a754554533685e`.

Este fechamento é **docs-only**. Ele registra a execução real do mecanismo canônico em
infraestrutura descartável e não altera nem executa backup, restore, runner, cron,
deploy ou produção.

## Vocabulário de estados

| Estado | Significado neste documento |
| --- | --- |
| `PROVED_IN_DISPOSABLE_INFRASTRUCTURE` | Comportamento observado no drill real, isolado e descartável descrito abaixo. Não constitui prova de produção. |
| `IMPLEMENTED_NOT_PROVED_IN_PRODUCTION` | Capacidade presente no repositório, mas sem evidência de execução no ambiente real de produção. |
| `MISSING` | Capacidade, decisão ou controle ainda ausente. |
| `CONFLICTING` | Há autoridades ou caminhos concorrentes que ainda exigem decisão/consolidação. |

`PROVED_IN_DISPOSABLE_INFRASTRUCTURE` nunca deve ser abreviado para `PROVED` sem o
qualificador do ambiente. A existência de código ou documentação, por si só, não
promove uma capacidade para esse estado.

## Evidência real do drill

O drill foi executado no WSL com Docker real por meio de:

```text
scripts/run-phase24-backup-restore-drill.sh
```

Resultado final registrado:

```text
phase24_postgres_host_ready
LOCAL_BACKUP_SUCCESS
restore_completed
phase24_relational_restore_verified
phase24_schema_write_verified
phase24_drill_completed:
backup, integrity, restore, relational fixture and schema usability proved

drill_exit=0
```

A evidência fecha exclusivamente a prova reproduzida em infraestrutura
descartável. Os tempos observados não definem nem permitem inferir SLA, RPO ou RTO.

## `PROVED_IN_DISPOSABLE_INFRASTRUCTURE`

No limite estrito do drill de `2026-09-13`, ficou provado que:

- um PostgreSQL 15 dedicado sobe e fica acessível pelo host;
- `prisma migrate deploy` aplica as 67 migrations;
- a fixture relacional é persistida;
- o backup canônico gera um artefato `.sql.gz`;
- `gzip -t` passa;
- o SHA-256 é gerado e validado;
- o backup emite `LOCAL_BACKUP_SUCCESS`;
- o banco é destruído e recriado;
- o restore canônico valida o checksum antes de escrever;
- o restore executa o `psql` com `ON_ERROR_STOP`;
- o restore completa com sucesso;
- não há migrations pendentes após o restore;
- `Organization`, `Customer`, `Appointment`, `ServiceOrder`, `Charge` e `Payment`
  são restaurados corretamente;
- valores, relações e enums são preservados;
- uma nova escrita no schema após o restore funciona;
- o cleanup remove container, network, volume e artefatos temporários; e
- nenhum recurso da Fase 2.4 permanece após o drill.

Esses resultados provam o mecanismo local canônico de backup/restore e as
invariantes verificadas pelo runner. Não provam operação, dados, storage, agenda ou
recovery no ambiente de produção.

## `IMPLEMENTED_NOT_PROVED_IN_PRODUCTION`

- O backup canônico está implementado, porém não foi executado no host real de
  produção.
- O restore canônico está implementado e foi provado somente no alvo descartável;
  restore de produção não foi executado.
- O suporte a upload S3/offsite está implementado, mas nenhum upload real foi
  provado.
- A topologia e o fluxo de deploy presentes no repositório não constituem prova de
  deploy, rollback ou recovery em produção.

## `MISSING`

Continuam ausentes ou sem aprovação/evidência operacional:

- cron instalado em produção;
- estratégia offsite aprovada e upload S3/offsite real;
- criptografia offsite;
- lifecycle e versioning do bucket;
- política de retenção offsite;
- sinalização e alertas de falha;
- deploy de produção;
- rollback de aplicação;
- restore de produção e DR completo;
- runbook canônico de produção;
- owner de DR; e
- objetivos aprovados de RPO e RTO.

**RPO = `NOT_DEFINED`**<br>
**RTO = `NOT_DEFINED`**

A duração deste drill não é RTO. A frequência de qualquer exemplo ou template de
cron não é RPO. Nenhum SLA é inferido desta evidência.

## `CONFLICTING`

- O cron e `infra/backup/run-backup.sh` ainda representam o fluxo legado, enquanto
  `scripts/backup-db.sh` é o caminho canônico. Nenhum cron foi consolidado ou
  instalado nesta onda.
- Compose e Railway permanecem alvos concorrentes até uma decisão operacional
  explícita. A prova descartável não determina qual plataforma está ativa em
  produção.

## Limites do fechamento

A Onda 2A não prova:

- backup no host real de produção ou cron instalado em produção;
- upload S3/offsite, criptografia, lifecycle, versioning ou retenção offsite;
- alertas de falha;
- deploy ou rollback de aplicação em produção;
- restore de produção ou DR completo; nem
- RPO, RTO ou qualquer SLA.

Não houve mudança em scripts, Compose, API, BFF, frontend, schema Prisma ou
produção para registrar este fechamento.

## Próxima etapa — Fase 2.4 Onda 2B

A Onda 2B fica registrada, **sem implementação nesta mudança**, para:

1. consolidar o cron para o script canônico;
2. definir a estratégia offsite;
3. definir encryption, versioning e lifecycle;
4. adicionar sinalização e alerta de falha;
5. fechar a decisão Compose versus Railway;
6. criar o runbook canônico de produção;
7. definir o owner de DR; e
8. manter RPO e RTO como decisão futura até aprovação explícita.
