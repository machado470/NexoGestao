# Captura completa do resultado do backup — 12/11/2026

Base `24f7ca03`, branch `fix/backup-captura-logs`, raiz `/workspace/NexoGestao`, início limpo; sem AGENTS.md aplicável. README/manifests, runner, engine e testes consultados. PR #1054 integrado com os três checks aprovados.

## Falha confirmada

O runner usava duas substituições de processo (`tee` em stdout e outro `tee -a` em stderr), sem aguardar seus términos antes de ler o arquivo. Além de dois escritores concorrentes, o exit code observado era apenas o do engine. Com captura atrasada, o estado podia perder artifactName/motivo de falha; com tee falhando, podia publicar sucesso mesmo sem capturar o resultado.

Três testes determinísticos com engine e tee simulados reproduziram os casos: saída de sucesso atrasada, erro offsite atrasado em stderr e falha do capturador. [Antes](backup-output-evidence/before.txt).

## Correção

`scripts/run-production-backup.sh` usa agora um pipeline em foreground, com um único tee e stdout/stderr do engine combinados. O shell aguarda ambos; PIPESTATUS é copiado imediatamente. Mantém código não zero do engine; se apenas a captura falhar, retorna 70. Falha de captura produz UNKNOWN_FAILURE e não publica sucesso. O nome do artefato e a classificação são lidos após o pipeline terminar.

Os logs do engine continuam ao vivo, agora combinados no stdout do runner; os eventos de falha do próprio runner continuam em stderr. Nenhuma alteração no formato JSON, lock, dump, upload ou retenção. CI passa a executar `scripts/backup-runner-output.test.mjs` junto das regressões operacionais.

## Validação e limites

- [31 testes Node aprovados](backup-output-evidence/after.txt): checker, restore, concorrência e três cenários novos de captura. O erro offsite conserva exit 23, motivo correto e artefato; captura falha não resulta em sucesso.
- [Suíte shell existente aprovada](backup-output-evidence/regression.txt). `bash -n scripts/run-production-backup.sh` e `git diff --check` passaram.
- Engines/loggers simulados, estados em diretórios temporários próprios removidos ao terminar. Sem banco, Docker, provider, alerta ou dados reais. Não se repetiram build/tipos API/web porque não houve alteração nesses fontes.

AU12 segue parcial: isto corrige o resultado registrado localmente, sem provar offsite, entrega de alerta ou operação produtiva. Responsáveis e objetivos continuam pendentes. AU08/AU11 também permanecem parciais.
