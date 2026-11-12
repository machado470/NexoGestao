# Checagem opcional de estado do backup — 12/11/2026

**AU12 — parcial.** Acrescentada checagem local automatizável; não há prova nova de offsite, alerta entregue, cron real ou recuperação em produção.

## Diagnóstico e mudança

Base `f90d0a92`, branch `fix/backup-verificacao-estado`, raiz `/workspace/NexoGestao`. Workspace limpo no início, sem AGENTS.md aplicável. README/manifests, runbook e scripts de backup/restore/status/testes consultados. O PR #1049 foi integrado com os três checks aprovados.

`scripts/backup-status.sh` imprimia apenas `last-attempt.json`. Essa consulta factual é preservada. Novo modo `--check --max-age-seconds <inteiro positivo> [--require-offsite]` delega a `scripts/check-backup-state.mjs`, usando Node já exigido pelo runner. Não presume política de idade/RPO/RTO.

Valida schema, resultado local, datas, consistência entre última tentativa e sucesso e idade máxima. Última tentativa falha não é mascarada por sucesso anterior. Offsite é exigido somente por opção explícita. JSON de resultado usa campos conhecidos, sem copiar conteúdo bruto de estado nem caminhos/credenciais. Exit 0: passou; 1: checagem reprovada; 64: argumentos/configuração inválidos. Datas futuras falham; relógio do host deve estar correto. O monitor deve repetir snapshots inconsistentes transitórios e investigar persistência da condição.

Arquivos: script de status, novo checker e `scripts/check-backup-state.test.mjs`; CI ganhou etapa dos testes locais; runbook documenta opções, códigos e limites.

## Evidências

- `node --test scripts/check-backup-state.test.mjs`: **12 testes passaram**. Recente, vencido, falha, data futura/inválida, dump não criado, política ausente/inválida, estado inválido sem vazar conteúdo, snapshot ausente/divergente, exigência offsite e preservação byte a byte do modo factual. [Log](backup-check-evidence/checker.txt).
- `bash scripts/test-production-backup.sh`: passou, incluindo modo local/offsite simulado, falha, não exposição de credenciais no estado e lock concorrente. [Log](backup-check-evidence/runner.txt).
- `bash -n scripts/backup-status.sh`, `node --check scripts/check-backup-state.mjs` e `git diff --check`: passaram.
- Dados/estados fictícios em diretórios temporários próprios, removidos pelos testes. Sem Docker, banco, provedor externo, publicação ou mensagem enviada. Não se repetiram build/tipos de produto porque nenhum fonte de API/web foi alterado.

## Pendências exatas

Checagem de estado não consulta bucket nem valida artefato. Faltam DR owner/substituto, idade máxima/RPO/RTO aprovados, ambiente/canal de monitoramento, entrega comprovada de alerta e drill com upload/download/checksum/restore e controles de retenção/acesso. Nenhum nome, prazo ou canal foi inventado; nenhum cron foi instalado. AU08 e AU11 seguem parciais.
