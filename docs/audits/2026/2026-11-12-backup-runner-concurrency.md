# Serialização do runner de backup — 12/11/2026

Base `2c6cb949`, branch `fix/backup-runner-concorrencia`, raiz `/workspace/NexoGestao`; início limpo, sem AGENTS.md aplicável. README/manifests, runner, engine, checker e testes consultados. PR #1053 integrado com os três checks aprovados.

## Falha e correção

O engine já tem lock para o dump, mas o runner não serializava a publicação de estado. Duas invocações com o mesmo BACKUP_STATE_DIR podiam escrever last-attempt e snapshots enquanto outra ainda executava; até uma segunda configuração inválida publicava falha no estado da execução ativa. O snapshot era copiado de last-attempt, portanto a exclusão mútua precisa cobrir todo o ciclo, não apenas pg_dump.

`scripts/run-production-backup.sh` agora adquire `.backup-runner.lock` no diretório de estado antes de validar modo/dependências e iniciar engine. A invocação concorrente retorna **75/LOCKED**, não executa o engine nem publica estado. Somente a dona remove sua trava ao terminar; o cleanup também remove o arquivo temporário de log. O lock do engine continua existindo e protege invocações diretas. Formato JSON e caminhos anteriores são preservados.

Novo `scripts/backup-runner-concurrency.test.mjs`, executado no CI junto das regressões de backup. Dois testes pausam deterministicamente a primeira execução no engine simulado e tentam uma segunda com modo local ou inválido; exigem uma única chamada ao engine, ausência de publicação pela concorrente e snapshots finais idênticos, com trava removida.

## Evidências

- [Antes](backup-runner-concurrency-evidence/before.txt): os dois cenários reprovaram; a segunda invocação retornou sucesso/configuração inválida, em vez de respeitar exclusão mútua.
- [Depois](backup-runner-concurrency-evidence/after.txt): **28 testes Node passaram** (checker, checksum/destino de restore e os dois novos de concorrência).
- [Regressão](backup-runner-concurrency-evidence/regression.txt): suíte shell do runner/engine passou. `bash -n scripts/run-production-backup.sh` e `git diff --check` passaram.

Dados/estados fictícios em diretórios temporários e engine simulado. Não houve acesso a banco, Docker, offsite ou canal externo nesta etapa. Nenhum reset/deploy/remoção de volumes. Não se repetiram build/tipos de API/web, cujos fontes não mudaram.

## Limites

A trava é local ao filesystem do diretório de estado; não é coordenação distribuída entre diretórios/hosts independentes. Encerramento não capturável (SIGKILL/quebra de energia) pode deixar trava, como no engine; recuperação exige confirmar que não há execução ativa antes de removê-la. Isso não é prova de alerta entregue/offsite nem definição de responsável/RPO/RTO. AU12 permanece parcial, assim como AU08/AU11.
