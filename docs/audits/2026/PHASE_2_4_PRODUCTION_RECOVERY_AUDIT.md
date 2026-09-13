---
status: current
owner: nexogestao
last_reviewed: 2026-09-13
source_of_truth: true
---

# Fase 2.4 — auditoria de produção, backup e recovery

## Onda 2A — implementação e prova descartável (2026-09-13)

### IMPLEMENTED

- `scripts/backup-db.sh` é o caminho canônico futuro: lock, `umask 077`, temporário no mesmo filesystem, gzip validado, SHA-256 verificado antes da publicação, rename, cleanup por trap e retenção somente após backup íntegro.
- Resultados local e offsite são independentes. Eventos distinguem `LOCAL_BACKUP_SUCCESS`, `OFFSITE_UPLOAD_SUCCESS`, `OFFSITE_UPLOAD_SKIPPED` e `OFFSITE_UPLOAD_FAILED`; pedido de upload sem bucket/AWS CLI falha com status diferente de zero.
- `scripts/restore-db.sh` aceita apenas o padrão canônico com sidecar, valida checksum e gzip antes de escrever, mostra o alvo, proíbe produção, exige opt-in no modo não interativo, usa `psql ON_ERROR_STOP`, aplica `prisma migrate deploy` e verifica migrations.
- `.env.prod.example` é o contrato sanitizado. Deploy e Compose agora falham cedo para banco, Redis, autenticação, URLs, Stripe e credenciais condicionais do provider WhatsApp, sem defaults produtivos conhecidos para banco/Redis.
- Compose/runner próprios da Fase 2.4 validam o alvo real e exercitam migrations, fixture relacional, backup, recriação do banco, restore e comparação de PK/FK, enums, timestamps e valores monetários.
- O backup legado e o cron foram preservados, marcados como não canônicos/template não instalado; nenhum cron foi ativado.

### PROVED

- **Mecanismo local descartável:** depende da evidência de execução abaixo. Uma passagem prova somente o caminho PostgreSQL isolado, nunca backup, agenda, host ou recovery de produção.

### NOT_PROVED

- Produção, cron instalado, storage/capacidade real, offsite, IAM, criptografia, bucket policy, versioning, lifecycle, alertas/dashboard e execução por operador continuam `NOT_PROVED`.
- Railway não foi removido nem declarado desativado. O drill valida PostgreSQL independentemente; Compose segue autoridade estática do repositório e a plataforma real exige confirmação operacional.
- Restore SQL pode deixar o alvo parcialmente escrito após erro. A abordagem segura é banco novo/descartável, como no drill, não restore in-place como primeira escolha.

### MISSING

- RPO e RTO permanecem `NOT_DEFINED`: `RETENTION_DAYS` não é RPO e duração do script/drill não é RTO ou SLA.
- Criptografia/offsite comprovados, alerting externo e runbook/ownership de produção ficam para decisão posterior; a Onda 2B não começa aqui.

### CONFLICTING

- Cron e `infra/backup/run-backup.sh` ainda representam o fluxo legado, deliberadamente não instalado nesta onda. Consolidação operacional fica para uma onda posterior.
- Compose é autoridade estática no Git e `railway.json` permanece presente; isso não demonstra qual plataforma está ativa.

### Evidência da Onda 2A

Os checks e o drill desta mudança são registrados no fechamento. `PROVED` significa somente drill E2E concluído em infraestrutura descartável na data informada; sem Docker, o estado correto é `IMPLEMENTED_NOT_PROVED`.

- Data: `2026-09-13` (UTC).
- `bash -n` nos três scripts, `pnpm prisma:check` e `git diff --check`: passaram.
- `docker info`: indisponível neste ambiente; o drill E2E não foi executado. Portanto backup e restore permanecem **`IMPLEMENTED_NOT_PROVED`**, e nenhum item desta onda foi promovido a `PROVED`.

## Escopo, baseline e método

Esta é uma auditoria **docs-only** do repositório no merge `9f7926e15c47a43866da27c98d9bcb5fe8019c41` (PR #1011). As fases 2.3A, 2.3B, 2.3C e 2.3D continuam `CLOSED`; nenhuma regressão nova foi identificada ou investigada aqui. Nenhum comando de deploy, backup, restore, cron, S3 ou migration foi executado.

`PROVED` neste documento exige evidência de execução no ambiente declarado. Presença de código, comentário, checkbox ou runbook prova somente implementação/documentação. A inspeção estática e `bash -n` não provam produção. Não houve acesso ao host, cron instalado, volumes, bucket, logs, credenciais ou artefatos de backup; portanto o **estado efetivo do ambiente hoje não pode ser inferido do Git**.

## Veredito executivo

1. **Autoridade de repositório para o alvo Compose:** `dev/deploy-prod.sh`, orquestrando `docker-compose.prod.yml`. É o único fluxo executável completo que o guia arquivado referencia. Isso não prova que seja o fluxo realmente usado no host. `railway.json` permanece um alvo concorrente e incompleto; logo a escolha de plataforma real ainda requer decisão/owner.
2. **Migrations no fluxo Compose:** o passo explícito `npx prisma migrate deploy` de `dev/deploy-prod.sh`. `AUTO_MIGRATE=1` no entrypoint é uma segunda forma disponível, mas não é configurada pelo Compose de produção. `pnpm prisma:migrate:deploy` é o comando equivalente para execução fora desse fluxo.
3. **Backup manual canônico no repositório:** `scripts/backup-db.sh`, por aceitar os defaults do Compose, gerar checksum e ter configuração explícita. **O agendamento versionado não o chama**: o cron chama `infra/backup/run-backup.sh`, com outro diretório, nome e retenção. Backup automático permanece `CONFLICTING`, não uma capacidade provada.
4. **Restore canônico disponível:** `scripts/restore-db.sh`, única implementação encontrada. Ele é apenas um script implementado, não recovery provado e ainda não é seguro o bastante para uso de produção.
5. **RPO:** `NOT_DEFINED`. **RTO:** `NOT_DEFINED`. Nenhuma periodicidade ou duração descrita abaixo constitui SLA.
6. O ambiente não pode ser chamado de production-ready: faltam prova end-to-end de deploy/restore, artefato de env de produção, offsite/criptografia provados, alerta de falha, ownership de DR, rollback testado e reconciliação das duas linhas de backup.

## Separação de ambientes

| Ambiente | Autoridade no repositório | Limite desta auditoria |
| --- | --- | --- |
| dev/local | `docker-compose.yml`, `.env.example`, `scripts/dev-full.sh` | Não é evidência de produção. Defaults locais e seed não devem ser copiados para produção. |
| test | CI, Compose/harnesses de integração e `DATABASE_URL` isoladas | Prova suites específicas, não deploy nem restore produtivo. |
| staging | `docker-compose.staging.yml`, `.env.staging.example`, `dev/deploy-staging.sh`, `docs/operations/staging-runbook.md` | O runbook declara staging. Não é promovido a runbook de produção. |
| production (Compose) | `dev/deploy-prod.sh` + `docker-compose.prod.yml`, conforme decisão documental desta auditoria | Implementado no Git; execução no host não provada. |
| production (Railway) | `railway.json` | Alvo concorrente, sem backup/restore/migrations/runbook suficientes; não canônico nesta auditoria. |

Os documentos arquivados misturam risco de ambiente ao usar exemplos/defaults e ao descrever como atual uma instalação em `/home/ubuntu`. O runbook de staging menciona incidente de `migrate deploy` “em produção”, mas seus comandos e alvo continuam exclusivamente staging. `docs/audits/2026/PRODUCTION_READY.md` inclui `migrate dev`; esse comando não integra a autoridade de produção e não deve ser usado nela.

## Inventário de artefatos

| Artefato | Função | Ativo? | Referenciado por | Fonte de verdade? | Concorrente com | Risco | Ação recomendada |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `docker-compose.prod.yml` | Topologia Compose: Postgres 15, Redis 7, API, web, nginx, certbot e volumes | Sim, executável; uso não provado | próprio cabeçalho, `dev/deploy-prod.sh`, guia arquivado, nginx SSL | Sim, **somente para topologia Compose** | `railway.json` | plataforma real não decidida; Redis tem senha default; mount `./scripts/backup:/backups` aponta para diretório ausente | Onda 2 validar configuração renderizada e eleger plataforma com owner. |
| `dev/deploy-prod.sh` | Build/up, espera do DB, migration, health interno e smoke público condicional | Sim, executável; execução não provada | guia arquivado; `docs/operations/deployment.md` cita scripts `dev/` genericamente | Sim, fluxo Compose eleito | Railway; `AUTO_MIGRATE` do entrypoint | depende de `.env.prod.example` inexistente; `pull` tolera falha; web/smoke podem falhar ou ser pulados sem abortar | Tornar runbook explícito, fechar gates e capturar evidência em ambiente descartável. |
| `dev/smoke-prod.sh` | Smoke HTTP público | Sim; execução não provada | deploy e guia arquivado | Autoridade de smoke do fluxo Compose | healthchecks do Compose | é pulado sem `DOMAIN`; resultado histórico ausente | Definir endpoints/critério obrigatório e evidência. |
| `railway.json` | Configuração mínima de production Railway | Sim, mas incompleta | `docs/operations/deployment.md` | Não | Compose | CORS localhost; não descreve DB, Redis, migration, backup ou recovery | Decidir manter ou desautorizar na Onda 2. |
| `scripts/backup-db.sh` | Dump SQL plain via `pg_dump`, gzip, SHA-256, retenção configurável e upload S3 opt-in | Sim, sintaxe auditada; execução não provada | comentário próprio; `scripts/doctor.sh` | Sim, backup manual eleito | `infra/backup/run-backup.sh` | parser de `--container` frágil; sem lock, criptografia, verificação lógica ou permissão explícita; upload ausente pode terminar com sucesso | Endurecer e testar isoladamente na Onda 2. |
| `infra/backup/run-backup.sh` | Dump SQL/gzip, SHA-256, retenção fixa de 7 dias e S3 opcional | Sim, sintaxe auditada; execução não provada | cron e guia arquivado | Não; legado ainda referenciado | `scripts/backup-db.sh` | hardcodes, S3 sem checksum, sem lock/cripto; linha de upload só existe se env chegar ao cron | Substituir referência após validação; não apagar nesta onda. |
| `infra/cron/nexogestao-backup.cron` | Agenda backup diário 02:00 e limpeza mensal de logs | Versionado; instalação não provada | guia arquivado | Não enquanto chamar linha legada | comentário cron em `scripts/backup-db.sh` | caminho de host fixo, roda root, env S3 não carregado, sem lock nem alerta | Criar instalação parametrizada/monitorada apenas após decisão. |
| `scripts/restore-db.sh` | Confirmação interativa e pipe gunzip → psql | Sim, sintaxe auditada; execução não provada | checklist SaaS e comentário próprio | Sim, única implementação, **não aprovada para produção** | nenhuma alternativa encontrada | não valida nome/checksum/gzip/target; restore in-place e falha parcial | Reprojetar e provar em DB descartável. |
| `docs/operations/deployment.md` | Gates e inventário geral de deploy | Sim (`review`) | `docs/index.md` | Fonte documental em revisão | guia arquivado | reconhece, mas não resolve Compose vs Railway; `supersedes` aponta caminho inexistente `docs/DEPLOYMENT_GUIDE.md` | Incorporar decisão e runbook depois das provas. |
| `docs/operations/staging-runbook.md` | Runbook canônico de staging | Sim (`current`) | `docs/index.md` | Sim, apenas staging | arquivos arquivados de staging | pode ser indevidamente reutilizado em produção | Manter separação explícita. |
| `docs/archive/DEPLOYMENT_GUIDE.md` | Guia histórico de Compose/cron | Arquivado | deployment atual e index indiretamente | Não | deployment atual | afirma `.env.prod.example` inexistente, backup automático e S3 sem prova | Usar apenas como rastreio histórico. |
| `docs/archive/RUNBOOK_STAGING.md` | Runbook histórico de staging | Arquivado | runbook atual | Não | runbook atual | comandos/rollback de staging não provam produção | Não usar em produção. |
| `docs/audits/2026/SaaS_PRODUCTION_CHECKLIST.md` | Checklist amplo | Versionado, mas evidência insuficiente para recovery | nenhum fluxo operacional encontrado | Não para prontidão de recovery | esta auditoria | `[x]` comprova presença de scripts, não backup/restore funcionais | Referenciar esta matriz factual em revisão futura. |
| `docs/PROJECT_STATE.md` | Estado e prioridades do projeto | Sim (`current`) | catálogo documental | Sim para estado do projeto | — | já registra ausência de autoridade única | Atualizar somente após Onda 2, sem reabrir 2.3. |
| `.env.example`, `examples/env/.env.example`, `apps/api/.env.example` | Exemplos majoritariamente local/API | Sim | docs e scripts locais | Não para production | `.env.staging.example`; `.env.prod.example` ausente | chaves divergentes; valores de dev; não cobrem contrato integral do Compose/deploy/backup | Criar contrato de env de produção sem valores reais na Onda 2. |

## Matriz de autoridade consolidada

“Autoridade” abaixo significa **autoridade estática do repositório a partir desta auditoria**, não prova de operação no host.

| Assunto | Autoridade única | Estado factual | Observação/conflito |
| --- | --- | --- | --- |
| deploy production | `dev/deploy-prod.sh` + `docker-compose.prod.yml` | `IMPLEMENTED_NOT_PROVED` | autoridade condicionada à plataforma Compose; Railway requer decisão explícita |
| migrations production | passo 7 de `dev/deploy-prod.sh` (`prisma migrate deploy`) | `IMPLEMENTED_NOT_PROVED` | entrypoint pode executar o mesmo tipo de migration com `AUTO_MIGRATE=1`; não habilitado pelo Compose |
| backup PostgreSQL | `scripts/backup-db.sh` | `IMPLEMENTED_NOT_PROVED` | cron ainda executa a implementação legada |
| upload/offsite | ramo `--upload` de `scripts/backup-db.sh` | `IMPLEMENTED_NOT_PROVED` | configuração, bucket e execução não provados; ausência de CLI/bucket é tratada como sucesso |
| retenção | `RETENTION_DAYS` de `scripts/backup-db.sh` (default documental 30 dias) | `IMPLEMENTED_NOT_PROVED` | cron legado usa 7 dias; nenhuma execução prova expiração efetiva |
| restore | `scripts/restore-db.sh` | `IMPLEMENTED_NOT_PROVED` | não aprovado para produção até hardening e teste E2E |
| rollback operacional | nenhum | `MISSING` | parar promoção/preservar evidência aparece apenas como orientação de staging |
| secrets/env | `.env.prod` local consumido pelo deploy/Compose | `MISSING` como contrato versionado | `.env.prod.example` referenciado não existe; exemplos atuais são dev/staging |
| healthcheck | healthchecks de `docker-compose.prod.yml` + etapas 6–10 do deploy | `IMPLEMENTED_NOT_PROVED` | smoke externo pode ser pulado e web unhealthy não aborta |
| observabilidade pós-deploy | logs Compose/json-file; Sentry somente variável sugerida | `DOCUMENTED_ONLY` | sem dashboard, janela, owner ou alerta comprovado |
| rollback de aplicação | nenhum procedimento canônico | `MISSING` | script sempre builda o checkout atual; sem imagem/tag anterior ou critério |
| rollback/correção de migration | **forward-fix migration** ou **restore de backup validado**, por decisão operacional; nunca `migrate reset` | `DOCUMENTED_ONLY` | não existe automação/prova de nenhum dos dois caminhos |

Esta eleição elimina ambiguidade para leitura e para a próxima implementação, mas **não altera cron, host ou produção**. Até a Onda 2 fechar o conflito, ninguém deve inferir que o cron legado passou a chamar o backup eleito.

## Auditoria do backup

### Implementação eleita: `scripts/backup-db.sh`

- **Ferramenta/formato:** `pg_dump --no-owner --no-acl --clean --if-exists`, saída SQL plain enviada a `gzip -9`; não é formato custom e, portanto, o consumidor é `psql`, não `pg_restore`.
- **Compatibilidade Compose:** defaults de container (`nexogestao_postgres_prod`), user (`nexo`) e database (`nexogestao`) coincidem com defaults do Compose. Valores não default dependem de o mesmo env chegar ao script. O volume `/backups` do container não é relevante ao dump feito no host; o host default `/backups` precisa existir e ser gravável. O bind source `./scripts/backup` declarado no Compose não existe no baseline.
- **Nome/destino:** `nexogestao_backup_YYYYMMDD_HHMMSS.sql.gz` em `BACKUP_DIR` (default `/backups`). Não há proteção contra duas execuções no mesmo segundo.
- **Permissões:** `mkdir -p` usa umask do executor; não há `umask`, `chmod`, usuário dedicado ou teste de owner. Cron legado roda como root.
- **Integridade:** gera sidecar SHA-256 depois do dump, mas não executa `gzip -t`, não verifica SQL, não valida checksum antes de upload/retention e o restore ignora o sidecar.
- **Erro/parcial:** `set -euo pipefail` captura falha no pipeline. Não há arquivo temporário + rename atômico nem trap para apagar `.sql.gz` truncado. A mensagem de sucesso vem após geração do checksum.
- **Upload:** opt-in `--upload`; envia dump e checksum ao S3 quando bucket e AWS CLI existem. Se CLI ou bucket faltarem, somente registra mensagem e termina com sucesso. Uma falha real de `aws s3 cp` aborta; se o primeiro objeto subir e o sidecar falhar, fica upload parcial. Não há retry, confirmação remota, lifecycle ou versioning comprovado.
- **Criptografia:** nenhuma criptografia client-side. TLS/SSE/bucket policy não são configurados ou provados no repo.
- **Retenção:** `find -mtime +RETENTION_DAYS -delete` atua apenas localmente após backup/upload. Não há retenção offsite. Falha anterior impede a limpeza; isso é preferível a limpar sem novo dump, mas não prova capacidade do filesystem.
- **Lock/log/sinal:** sem `flock`/lock; logs textuais em stdout/stderr; não há métrica, alerta, heartbeat ou notificação. O cron versionado redireciona logs da implementação concorrente a arquivo local.
- **Dependências/env:** bash, date, mkdir, Docker + container ou `pg_dump`, gzip, sha256sum, find, du e opcionalmente AWS CLI; `POSTGRES_PASSWORD` só é usado no modo local. O parser de argumentos assume `${2}` global para `--container`, de modo que ordem/argumentos inválidos não são rejeitados adequadamente.

### Respostas binárias, limitadas à evidência

| Pergunta | Resposta | Evidência/limite |
| --- | --- | --- |
| backup local existe? | **IMPLEMENTED_NOT_PROVED** | existem duas implementações, sem artefato ou log de execução inspecionado |
| backup automático existe? | **DOCUMENTED_ONLY / CONFLICTING** | existe cron versionado, mas instalação não foi provada e ele chama o script não canônico |
| backup offsite existe? | **IMPLEMENTED_NOT_PROVED** | há código S3 opcional; bucket, credenciais e objeto remoto não foram verificados |
| backup criptografado existe? | **MISSING** | nenhuma criptografia client-side; controles server-side não estão provados |
| checksum existe? | **IMPLEMENTED_NOT_PROVED** | ambos geram SHA-256 local; restore não o valida e nenhum sidecar real foi inspecionado |
| retenção é efetiva? | **IMPLEMENTED_NOT_PROVED / CONFLICTING** | código tem 30 dias configuráveis versus 7 dias fixos; nenhuma rotação foi observada |
| falha gera sinal observável? | **MISSING** | exit code/log local não equivale a alerta; alguns pré-requisitos de upload geram sucesso |

## Auditoria do restore

`scripts/restore-db.sh` aceita qualquer arquivo regular passado como primeiro argumento; não restringe basename/extensão, não procura sidecar SHA-256 e não executa `sha256sum -c` nem `gzip -t`. A confirmação literal `sim` reduz erro casual, porém não verifica `NODE_ENV`, host, database, allowlist, frase contendo alvo, segunda pessoa ou janela; portanto **não é guard suficiente para produção** e bloqueia automação controlada.

O script restaura no banco existente com SQL `--clean --if-exists` produzido pelo backup. Não cria banco novo, não corta conexões, não coloca API/workers em manutenção, não faz snapshot prévio nem troca atômica. `--no-owner --no-acl` reduz dependência de roles/ACLs, mas não há inventário/teste de roles e extensions. Usa `psql`, coerente com SQL plain; não deve usar `pg_restore` neste formato.

Não há etapa para verificar versão de PostgreSQL, espaço, permissões, schema esperado ou origem do dump; migrations pendentes pós-restore; `prisma migrate status`; contagens/invariantes/health; cleanup; relatório; ou retomada da aplicação. `set -o pipefail` faz o processo retornar erro se gunzip/psql falhar, mas o banco pode ficar **parcialmente alterado**. Não há transação única, rollback do restore, banco sombra ou plano de continuação.

Conclusão rigorosa: o repositório **tem script de restore** (`IMPLEMENTED_NOT_PROVED`); não existe evidência de que **restore foi provado end-to-end** (`MISSING`). A prova futura deve ocorrer exclusivamente em infraestrutura descartável, a partir de backup produzido pelo caminho canônico, com hash, restore, migrations/status e verificações funcionais registradas. Produção fica fora dessa prova inicial.

## Migrations e recovery

O schema canônico é `prisma/schema.prisma` e a cadeia versionada está em `prisma/migrations/`. No fluxo Compose eleito, o deploy sobe os serviços e depois executa `npx prisma migrate deploy` no container API. O entrypoint também oferece `AUTO_MIGRATE=1`, mas o Compose de produção não o define; ativar ambos duplicaria responsabilidade e deve ser evitado.

**`prisma migrate deploy` não tem rollback automático.** A estratégia descrita no repositório é: preferir **forward-fix migration**; quando isso não for seguro, usar **restore de backup previamente validado**; rollback de aplicação é um eixo separado e ainda não tem procedimento canônico. Isso é apenas estratégia documental, não recovery provado. Não usar `prisma migrate reset`, `migrate dev`, edição de migration já aplicada ou workflow destrutivo em produção.

Há ainda risco de ordem: o deploy faz `up` antes do passo explícito de migration, e o entrypoint pode iniciar API com `AUTO_MIGRATE` desligado. Compatibilidade de aplicação com schema anterior não é provada. Tampouco há backup obrigatório imediatamente antes da migration, análise expand/contract ou regra de quando rollback da aplicação é incompatível com o novo schema.

## Segredos e dados sensíveis

Esta auditoria inspecionou apenas nomes/fluxo e não reproduz valores reais. `.env.prod` é ignorado/externo e consumido tanto via `source` pelo deploy quanto por `env_file`/substituição do Compose. O arquivo `.env.prod.example` instruído por script e guia **não existe**. Os exemplos existentes divergem e são de dev/API/staging.

| Grupo | Fluxo encontrado | Lacuna de produção |
| --- | --- | --- |
| PostgreSQL | Compose constrói `DATABASE_URL` de `POSTGRES_*`; script de backup usa os mesmos defaults | contrato/versionamento de todas as variáveis ausente; senha no URI/process env; permissões do dump indefinidas |
| Redis | Compose constrói `REDIS_URL` e persiste AOF | `REDIS_PASSWORD` tem default conhecido, em vez de fail-closed; backup/DR de Redis não definido |
| JWT/bootstrap | deploy exige `JWT_SECRET`; exemplos incluem bootstrap/auth | comprimento/rotação/storage/owner não definidos; deploy não valida todos os requisitos da API |
| Stripe | deploy apenas avisa por secret/webhook; exemplos listam prices | critério de produção e rotação não definidos; modo degradado não tem gate/alerta |
| WhatsApp | exemplos divergem entre mock, Z-API e Meta | provider produtivo e conjunto obrigatório não eleitos/validados pelo deploy |
| object storage/S3 | apenas backup opcional por AWS CLI/env; referências de produto não provam storage operacional | bucket, IAM mínimo, criptografia, versioning, lifecycle e restore/download ausentes |
| observabilidade | nomes Sentry variam (`SENTRY_DSN`, `SENTRY_DSN_API`, `VITE_SENTRY_DSN`) | contrato inconsistente e nenhum gate de entrega/alerta |
| arquivos de backup | diretórios criados com umask corrente | ausência de modo/owner dedicado, criptografia e segregação de acesso |

## Conflitos e fatos não demonstrados

1. Compose versus Railway permanece conflito de plataforma; a autoridade Compose desta auditoria é a única cadeia suficientemente ligada no Git, não evidência do host.
2. Backup de `scripts/` (30 dias, dump + checksum no S3) versus `infra/backup/` (7 dias, somente dump no S3); cron e guia histórico apontam o segundo.
3. Restore espera padrão `nexogestao_backup_*`, enquanto cron produz `nexogestao_prod_*`; tecnicamente aceita ambos porque valida apenas existência, justamente uma falha de segurança.
4. Compose monta `./scripts/backup:/backups`, diretório inexistente, enquanto backup manual default grava `/backups` no host e cron grava `/var/backups/nexogestao`.
5. `.env.prod.example` é requisito declarado, mas está ausente; exemplos disponíveis não constituem contrato produtivo.
6. Retenção de 7/30 dias, “backup diário”, S3, idempotência do deploy, SSL, health e checkbox de backup/restore são alegações sem evidência operacional anexada.
7. Health interno, smoke público condicional, logs locais e configuração Sentry não formam verificação/observabilidade pós-deploy com alerta e owner.
8. Não foi encontrado runbook de rollback de release, recovery de migration testado, catálogo de incidentes, inventário de extensions/roles, restore drill ou responsável por desastre.

## RPO e RTO

- **RPO: `NOT_DEFINED`**.
- **RTO: `NOT_DEFINED`**.

Para decisão futura, e não como garantia: medir primeiro duração/tamanho de dumps, frequência sustentável, tempo de download/decriptação, restore, migrations e smoke; então o negócio deve aprovar objetivos de RPO/RTO, retenção e custo. O cron “diário às 02:00” não define nem garante RPO, e a existência de um script não define RTO.

## Checklist factual de prontidão

| Item | Estado | Evidência | Risco | Próximo passo |
| --- | --- | --- | --- | --- |
| deploy | `IMPLEMENTED_NOT_PROVED` | script Compose completo no Git | plataforma/env e execução reais desconhecidos | prova descartável e decisão Compose/Railway |
| migrations | `IMPLEMENTED_NOT_PROVED` | passo `migrate deploy` explícito | ordem, backup prévio e compatibilidade não provados | ensaio de promoção com schema real anonimizado/fixture |
| DB persistence | `IMPLEMENTED_NOT_PROVED` | volume nomeado `pgdata_prod` | host, mount, capacidade e snapshot não observados | inspecionar ambiente e documentar storage/owner |
| backup local | `IMPLEMENTED_NOT_PROVED` | dois scripts | nenhum artefato verificado; duplicidade | endurecer caminho eleito e gerar fixture |
| backup automático | `CONFLICTING` | cron chama caminho legado | instalação/env/sucesso desconhecidos | substituir agenda após teste, com lock e monitor |
| backup offsite | `IMPLEMENTED_NOT_PROVED` | ramo AWS CLI/S3 | ausência pode retornar sucesso; sem prova remota | teste controlado de upload/download e IAM |
| encryption | `MISSING` | gzip não é criptografia | exposição de dados | decidir KMS/client-side e provar acesso |
| retention | `CONFLICTING` | 7 versus 30 dias | expiração/custo e RPO indefinidos | decisão de política + teste local/remoto |
| restore | `IMPLEMENTED_NOT_PROVED` | pipe para `psql` | alvo errado e estado parcial | guard, checksum, staging DB e relatório |
| restore test | `MISSING` | nenhum drill/evidência encontrado | backup pode ser inutilizável | prova E2E descartável |
| application rollback | `MISSING` | nenhum procedimento/tag anterior | release ruim sem retorno determinístico | definir artefato imutável e ensaiar rollback |
| migration recovery | `DOCUMENTED_ONLY` | forward-fix/restore descritos | nenhum caminho testado | cenários compatíveis/incompatíveis + drill |
| health verification | `IMPLEMENTED_NOT_PROVED` | Compose/deploy/smoke | checks podem ser pulados ou apenas avisar | tornar gates obrigatórios e externos |
| logs | `IMPLEMENTED_NOT_PROVED` | json-file e redirecionamento cron | somente host, rotação parcial, sem correlação DR | centralizar e definir consulta/retention |
| alerting | `MISSING` | nenhum alerta de backup/deploy/restore | falha silenciosa | heartbeat + alerta testado + escalation |
| secrets | `CONFLICTING` | exemplos divergentes; prod example ausente | defaults fracos/config incompleta | contrato env prod e secret manager/rotação |
| cleanup | `IMPLEMENTED_NOT_PROVED` | `find` local nos backups | sem temporários/cleanup de restore ou remoto | política segura e testes de expiração |
| disaster recovery ownership | `MISSING` | apenas owner genérico `nexogestao` | incidente sem responsável/decisor | nomear função primária, backup e escalation |

Nenhum item operacional recebeu `PROVED`: não há evidência versionada suficiente de execução de produção/recovery. O status `PROVED` poderá ser usado depois somente com comando, ambiente, data, resultado, artefato/hash e aprovação identificáveis, sem armazenar segredos.

## Gaps bloqueadores e ordem recomendada das próximas ondas

### Onda 2 proposta — hardening e prova segura (não implementada aqui)

1. **Decisão e contrato:** owner escolhe formalmente Compose ou Railway; consolidar runbook e criar `.env.prod.example` sanitizado com validação fail-closed, sem secret real.
2. **Backup único:** manter uma implementação; adicionar lock, umask/permissões, arquivo temporário + rename, `gzip -t`, checksum verificável, tratamento fail-closed do offsite e resultado observável. Só então trocar cron; preservar legado até migração confirmada.
3. **Prova local descartável:** produzir backup de um PostgreSQL compatível com o Compose, registrar versão, hash e logs, e testar retenção/concorrência/falhas sem dados reais.
4. **Restore seguro:** validar padrão, hash e gzip; exigir target não produtivo/guard explícito; restaurar em DB novo/sombra; tratar conexões, roles/extensions, falha parcial, migrations/status, invariantes, health e cleanup.
5. **Drill E2E:** upload/download criptografado, restore do mesmo artefato e smoke; medir tempos para subsidiar — não inventar — RPO/RTO.
6. **Deploy/recovery:** imagens imutáveis, backup gate antes de migration, estratégia expand/contract, forward-fix e rollback de aplicação testados; health externo e observabilidade pós-deploy obrigatórios.
7. **Operação:** alertas/heartbeat, retenção local e remota aprovada, logs centralizados, ownership/escalation e calendário periódico de restore drills.

Critério de saída futuro: uma única cadeia referenciada, sem concorrentes ativos; provas reproduzíveis de backup, offsite, restore e rollback; RPO/RTO decididos pelo negócio a partir de medições; e runbook executado por pessoa que não o escreveu. Nada disso é alegado pela Onda 1.

## Evidências estáticas executadas nesta onda

- `git rev-parse HEAD` confirmou exatamente o baseline informado e `git merge-base --is-ancestor` confirmou sua ancestralidade.
- `bash -n scripts/backup-db.sh scripts/restore-db.sh infra/backup/run-backup.sh dev/deploy-prod.sh dev/smoke-prod.sh` passou; é somente validação de sintaxe.
- Buscas com `rg` mapearam referências a Compose, backups, restore, Prisma, RPO/RTO, env e documentos. Não foi encontrada definição normativa de RPO/RTO nem alternativa de restore.
- `git diff --check` e `git status -sb` são os checks docs-only de fechamento; seus resultados pertencem ao commit desta auditoria, não à produção.
