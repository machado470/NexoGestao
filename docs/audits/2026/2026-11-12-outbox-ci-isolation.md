# Isolamento do teste real de Outbox — 12/11/2026

Base `3bf094ef`, branch `fix/ci-outbox-porta-isolada`. Workspace limpo no início; sem AGENTS.md aplicável. README, manifests, CI, Compose, script de recuperação e teste da Outbox consultados. PNPM 10.30.3.

## Diagnóstico

O PR #1047 foi integrado. A correção SSE passou no CI: 152 integrações e cinco testes de recuperação aprovados. Um quality-gate completo passou; outro falhou depois, ao iniciar Outbox, com `failed to bind host port 0.0.0.0:55432/tcp: address already in use` no job [131104090717](https://github.com/machado470/NexoGestao/actions/runs/43195154277/job/131104090717). Não foi falha de asserção da Outbox.

## Mudança

- `docker-compose.outbox-test.yml`: publica somente em loopback e deixa o Docker atribuir porta livre por padrão. Preserva `OUTBOX_TEST_POSTGRES_PORT` para escolha explícita.
- `scripts/run-outbox-integration.sh`: raiz independente do diretório de invocação, projeto único por execução, descoberta/validação da porta realmente publicada e URL passada aos comandos existentes. Traps encerram apenas seu próprio projeto; não removem volumes. Mantidos banco de teste, guard de segurança e suíte real existentes.
- Atualizadas as instruções da auditoria operacional que indicavam projeto/porta fixos e `down -v`.

## Validação

- Duas execuções simultâneas do script completo passaram: **três testes em cada**, com projetos distintos e portas Docker 32768/32769, enquanto um listener de teste próprio ocupava 55432. Migrations e geração Prisma também passaram em ambas. [Execução A](outbox-isolation-evidence/parallel-a.txt), [execução B](outbox-isolation-evidence/parallel-b.txt).
- Com `OUTBOX_TEST_POSTGRES_PORT=55432`, a execução retornou erro esperado de porta ocupada e encerrou somente seu projeto; o listener próprio permaneceu ativo até a limpeza final. [Evidência](outbox-isolation-evidence/occupied.txt).
- `bash -n scripts/run-outbox-integration.sh` e `git diff --check` passaram. Não foram repetidos testes gerais/build de produto, pois a alteração está restrita ao ambiente e script de integração.
- Containers/redes das execuções encerrados pelos traps; listener próprio encerrado ao terminar. Volumes preservados. O CI remoto da correção continua pendente.

O primeiro download da imagem Debian `postgres:15` falhou por espaço temporário; nenhuma suíte executou nessa tentativa. Para validar localmente foi atribuído o tag local `postgres:15` à imagem `postgres:15-alpine` já disponível (mesmo major, variante distinta). O arquivo Compose mantém `postgres:15`; o CI remoto continua necessário para validar a imagem padrão. Nenhum volume ou imagem existente foi apagado.

Sem código de produto, migração nova, reset, deploy ou chamadas externas. AU08 não foi implementado nesta etapa; AU11 parcial e AU12 seguem pendentes.
