# Isolamento dos testes de recuperação — 11/11/2026

O CI do PR #1042 falhou antes da recuperação porque o Redis de teste tentou publicar a porta fixa `56380`, já ocupada. O script também compartilhava o projeto Compose `nexogestao-phase23c`, permitindo que execuções concorrentes disputassem containers, rede e volume.

Base desta correção: `0800fa17`, merge do PR #1042 na main; branch `fix/ci-isolar-recuperacao`. Workspace limpo ao iniciar. Nenhum AGENTS.md aplicável. Mantidos PNPM 10.30.3, schema e dados da aplicação.

## Correção

- `scripts/run-phase23c-recovery.sh`: projeto novo com UUID por invocação; duas portas livres de loopback, publicadas explicitamente para permanecerem estáveis durante stop/start. Se outra aplicação capturar uma porta antes do Docker, o startup pode repetir até três vezes. Readiness e URLs usam as portas escolhidas. Cleanup só alcança o projeto daquela execução e não remove volumes.
- `docker-compose.phase23c-test.yml`: publicação restrita a `127.0.0.1`; opção `PHASE23C_POSTGRES_IMAGE` para reutilizar PostgreSQL 15 disponível localmente, conservando `postgres:15` como padrão do CI.
- `apps/api/test/integration/phase23c-harness.ts`: aceita endpoints parametrizados somente se corresponderem aos bindings dos containers do projeto dedicado. Mantém host local, banco `phase23c`, usuário de teste e namespace Redis `/15`. Inspeciona HostConfig, inclusive com container parado, antes de autorizar stop/start. Ambiente apontando para outro serviço não basta para autorizar a operação.
- `apps/api/test/phase23c-harness.spec.ts`: nove verificações de ownership, host, banco/usuário, namespace, projeto, porta inválida, container ausente e divergência entre ambiente e binding real.

Não foram alterados cálculos, contratos de produto, banco de desenvolvimento nem workflows de deploy. Os endpoints legados continuam disponíveis para uso manual do Compose; o script automatizado sempre escolhe um projeto novo e portas próprias.

## Validação

- `bash -n scripts/run-phase23c-recovery.sh`: passou.
- `docker compose -f docker-compose.phase23c-test.yml config --quiet`: passou.
- `apps/api/node_modules/.bin/tsc -p tsconfig.json --noEmit`, executado em apps/api: passou.
- Jest `test/phase23c-harness.spec.ts`: **9 passaram**.
- Duas execuções simultâneas de `PHASE23C_POSTGRES_IMAGE=postgres:15-alpine pnpm exec bash scripts/run-phase23c-recovery.sh`: **3 suítes e 5 testes passaram em cada execução**, incluindo indisponibilidade/reinício de PostgreSQL e Redis e replay da DLQ.
- Durante ambas, um processo sintético próprio manteve `55433` e `56380` ocupadas. Os dois projetos escolheram quatro portas distintas, passaram os testes e removeram apenas seus containers e redes. O processo das portas antigas permaneceu vivo até ser encerrado explicitamente após a validação. Volumes preservados.

A primeira tentativa local parou no download/descompactação de `postgres:15` por falta de espaço no armazenamento Docker. A validação aprovada reutilizou `postgres:15-alpine`, já presente, sem prune, reset ou remoção de volumes. Portanto a imagem Debian padrão não foi revalidada localmente nesta etapa; o padrão do CI permanece igual. Logs: [execução A](recovery-ci-evidence/concurrent-a.txt), [execução B](recovery-ci-evidence/concurrent-b.txt), [guard](recovery-ci-evidence/guard.txt), [tipos](recovery-ci-evidence/typecheck.txt).

## Verificações remotas acompanhadas

No commit já integrado `0800fa17`, o workflow [ci](https://github.com/machado470/NexoGestao/actions/runs/43113013636), o [api-docker](https://github.com/machado470/NexoGestao/actions/runs/43113013861) e a [validação Compose](https://github.com/machado470/NexoGestao/actions/runs/43113013773) concluíram com sucesso. O run de PR que ainda estava pendente também concluiu com sucesso. Isso não substitui os checks do novo commit desta correção.

O workflow [pages](https://github.com/machado470/NexoGestao/actions/runs/43113013779) falhou em `actions/deploy-pages` com 404 ao criar deployment; a própria ação orienta verificar se GitHub Pages está habilitado. Build concluído, falha na configuração/publicação do serviço. Hospedagem e configurações de Pages não foram alteradas, conforme o foco solicitado no projeto. Não se declara aprovação de todos os workflows de deploy.
