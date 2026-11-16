# Nome do artefato em diretórios com espaços — 12/11/2026

Base `da2a1379`, branch `fix/backup-nome-artefato`, raiz `/workspace/NexoGestao`; início limpo, sem AGENTS.md aplicável. README/manifests, engine/runner e testes consultados. PR #1055 integrado com os três checks aprovados.

## Achado e correção

O engine publica o caminho com escaping de shell (`printf %q`). O runner extraía o campo até o primeiro espaço e aplicava basename. Em uma pasta `artifacts with spaces`, o backup/checksum eram criados corretamente, mas last-success.artifactName se tornava `artifacts\`, impedindo usar essa referência para localizar o dump.

`scripts/backup-db.sh` mantém `artifact=` e acrescenta `artifact_name=` com o basename canônico, que não contém espaços. `scripts/run-production-backup.sh` prefere o campo novo; mantém o parser anterior como compatibilidade com logs antigos/fixtures. Não usa eval nem interpreta o conteúdo como comando. Nenhuma alteração de dump, retenção, upload ou schema JSON.

## Evidências

- [Antes](backup-artifact-evidence/before.txt): cenário com caminho simples passou; pasta com espaços reprovou pela referência truncada.
- [Depois](backup-artifact-evidence/after.txt): **33 testes Node passaram**, incluindo os dois cenários novos. Eles usam engine e runner reais com somente pg_dump/docker simulados; geram gzip/checksum no filesystem e verificam que o artefato apontado pelo estado existe e descomprime para o SQL fictício esperado.
- [Regressão do runner/engine](backup-artifact-evidence/regression.txt): suíte shell existente passou. `bash -n scripts/backup-db.sh scripts/run-production-backup.sh` e `git diff --check` passaram.

As regressões já estão incluídas no comando CI do arquivo de testes de saída. Não foram repetidos build/tipos API/web. Dados e diretórios temporários próprios foram removidos; sem banco real, offsite, alerta ou deploy nesta etapa.

## Limites

A compatibilidade com logs de engines antigos continua com o parser legado; pastas com espaços exigem atualizar engine e runner juntos, como neste PR. A correção é de rastreabilidade local. AU12 permanece parcial até responsáveis/objetivos e comprovação de offsite/alerta; AU08/AU11 também seguem parciais.
