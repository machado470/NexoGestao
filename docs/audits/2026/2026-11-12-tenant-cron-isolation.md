# Isolamento dos cron jobs nas suítes de tenant — 12/11/2026

Base `9e9e5944`, branch `fix/ci-isolamento-agendadores-tenant`, raiz `/workspace/NexoGestao`; início limpo, sem AGENTS.md aplicável. README/manifests, CI, logs, suites e agendadores consultados. A revisão visual de edição foi adiada para corrigir o CI identificado nesta rodada.

## Diagnóstico

PR #1062 integrado com Compose e um quality-gate aprovados; outro quality-gate falhou em `phase2-tenant-mutations-postgres.integration.spec.ts`. A requisição de gerar cobrança em outra organização retornou 404 e a contagem de cobranças permaneceu igual; a contagem global de Timeline passou de 0 para 1. [Trecho](tenant-cron-isolation-evidence/ci-failure.txt), [job](https://github.com/machado470/NexoGestao/actions/runs/43248241799/job/131286671217).

A suíte carregava AppModule com cron jobs ativos e supunha que nenhuma escrita independente ocorreria entre duas contagens. O serviço generateCharge procura a O.S. pelo tenant e retorna 404 antes de gerar cobrança. O log não identifica a ação do evento extra, portanto não permite atribuir qual agendador o produziu; é compatível com interferência de background. O teste novo confirmou deterministicamente que os cron jobs estavam ativos. Isso não é evidência de vazamento ou regressão dos formulários financeiros.

## Correção

Nas suítes `phase2-tenant-mutations-postgres.integration.spec.ts` e `phase2-execution-tenant-postgres.integration.spec.ts`, após inicializar a aplicação e antes das fixtures, os cron jobs dessa instância são parados pela API pública SchedulerRegistry. Todos os serviços/guards HTTP permanecem reais; nenhuma variável global ou configuração de produção foi alterada. A segunda suíte tinha as mesmas contagens globais antes/depois e recebeu a correção do mesmo padrão.

Cada suíte ganhou uma verificação de que os jobs estão registrados e inativos durante as asserções. Foram mantidas integralmente as exigências de 404, ausência de pagamento/idempotência indevida, contagens de Timeline e valores/status das entidades. Não houve filtragem para ignorar eventos nem inserção de sleeps para contornar o relógio.

## Verificação

- [Antes](tenant-cron-isolation-evidence/before.txt): oito testes originais passaram e a nova verificação de cron inativo reprovou (true em vez de false).
- [Bateria completa](tenant-cron-isolation-evidence/integration.txt): **166 testes passaram em 28 suítes**, 20 condicionais ignorados. Executada após o ajuste da suíte de mutações.
- [Versão final focada](tenant-cron-isolation-evidence/focused.txt): **13 testes passaram nas duas suítes** depois de estender o ajuste à suíte vizinha de execução. A bateria completa não foi repetida após essa extensão localizada; as contagens não devem ser somadas como testes distintos.
- [Typecheck API](tenant-cron-isolation-evidence/types.txt): passou. O Jest também compilou as duas suítes na execução final.
- `git diff --check`: passou. Não se repetiram lint/build/navegador do produto porque só testes/documentação mudaram.

Comandos via `npx --yes pnpm@10.30.3`, script `test:integration:real` e Jest focado; PostgreSQL local 55449 e Redis 56389/12. Provedores mock/schedules de envio desativados no ambiente local; as paradas de cron adicionadas no código são limitadas às duas instâncias de teste.

Fixtures próprias removidas pelas suítes; containers locais encerrados e volumes preservados. Sem produção, reset, deploy ou mensagem externa. A aprovação remota desta correção será acompanhada separadamente. AU08/AU11/AU12 continuam parciais; formulários de edição ainda não foram corrigidos nesta etapa.
