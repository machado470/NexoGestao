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

## Acompanhamento: dependência do teste no CI

O PR #1050 foi integrado, mas os dois quality-gates falharam no teste shell legado. No job [131120280112](https://github.com/machado470/NexoGestao/actions/runs/43199903482/job/131120280112), os 12 testes novos passaram; a suíte shell encontrou `rg: command not found` na verificação de retenção e reportou indevidamente `retention has multiple engines`. Compose passou.

Na base `8c2c1f35`, branch `fix/ci-backup-sem-ripgrep`, foi trocado somente `rg -l` por `grep -l` nessa verificação. Os dois comandos retornam os nomes dos arquivos correspondentes, mantendo a exigência de exatamente um motor. O teste já depende de grep em várias outras asserções; nenhum pacote extra foi adicionado ao CI. O código de backup/status não mudou.

Repetidos os 12 testes Node e a suíte shell com uma função Bash exportada `rg` que retorna 127 (simulação de comando indisponível): ambos passaram. [Checker](backup-check-evidence/portable-checker.txt), [runner](backup-check-evidence/portable-runner.txt). `bash -n scripts/test-production-backup.sh` e `git diff --check` passaram. A aprovação remota desta correção será conferida separadamente; AU12 continua parcial.
