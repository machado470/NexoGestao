# Checksum vinculado ao dump restaurado — 12/11/2026

## Falha confirmada e correção

Base `c4083562`, branch `fix/restore-checksum-artefato`, raiz `/workspace/NexoGestao`, início limpo, sem AGENTS.md aplicável. README/manifests, backup/restore, runbook e testes consultados. O PR #1051 já está integrado; Compose passou e quality-gates ainda estavam em execução na última consulta.

`scripts/restore-db.sh` executava `sha256sum -c` no sidecar, mas não exigia que ele descrevesse o dump passado ao restore. Um sidecar contendo hash correto de `decoy.txt` passava; em seguida o script restaurava outro `.sql.gz` sem validar seu hash. Várias entradas corretas também eram aceitas. Isso não prova acesso indevido nem exploração em produção; é uma falha na vinculação entre artefato e validação de integridade.

A correção aceita exatamente uma entrada no formato canônico gerado por `backup-db.sh` (`hash`, dois espaços, basename). Exige nome exato do arquivo solicitado e compara seu SHA-256 calculado diretamente. Não segue caminhos indicados pelo sidecar. Validação gzip, confirmação explícita, bloqueios de produção/alvo remoto, migrations e smoke existentes foram preservados.

Arquivos: `scripts/restore-db.sh`, novo `scripts/restore-checksum.test.mjs` e etapa de regressões de backup no CI. O runbook esclarece o contrato. Não houve alteração de schema, API ou web.

## Evidências

- [Antes](restore-checksum-evidence/before.txt): o teste de checksum para outro arquivo e o de múltiplas entradas reprovaram porque o script antigo retornou sucesso e alcançou o restore simulado.
- [Depois](restore-checksum-evidence/after.txt): **17 testes passaram**, sendo cinco novos cenários do restore e os 12 do checker de estado. Cobrem sidecar canônico válido, arquivo diferente, hash divergente, múltiplas entradas e sidecar ausente/malformado. Casos inválidos não invocam comandos de banco.
- [Regressão de backup](restore-checksum-evidence/backup-regression.txt): `bash scripts/test-production-backup.sh` passou.
- `bash -n scripts/restore-db.sh` e `git diff --check` passaram. Não foram repetidos build/tipos do produto por não haver alteração nesses fontes.

Os testes criam gzip/checksums reais de SQL fictício, mas simulam psql e pnpm para confirmar a fronteira sem executar restore/migration em banco. Diretórios temporários próprios são removidos. Não houve restore real, envio externo, instalação de cron, reset ou remoção de volumes.

## Limites e pendências

Checksum não autentica a origem: artefato e sidecar precisam vir de fonte autorizada. O drill real de upload/download/checksum/restore e a entrega de alerta continuam pendentes, assim como DR owner e RPO/RTO. AU12 permanece parcial; esta correção trata integridade local. AU08 e AU11 também seguem parciais.
