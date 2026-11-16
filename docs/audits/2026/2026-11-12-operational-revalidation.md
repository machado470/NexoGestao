# Revalidação do percurso operacional — 12/11/2026

Base `c0bea375`, branch `test/auditoria-fluxo-operacional`, raiz `/workspace/NexoGestao`; início limpo, sem AGENTS.md aplicável. README/manifests, suítes existentes, controllers/serviços de operação, Timeline, Auditoria e configurações consultados. PNPM 10.30.3. O PR #1058 está integrado com os três checks aprovados.

## Resultado

**23 testes de integração aprovados**, em quatro suítes, com PostgreSQL e Redis locais. Nenhuma nova regressão de negócio foi encontrada no percurso exercitado. Foram ampliadas as verificações do teste canônico em `apps/api/test/integration/canonical-operational-workflow.spec.ts`; não houve mudança em código de produção.

| Percurso | Evidência exercitada |
| --- | --- |
| Cliente | Criação HTTP, normalização de telefone, persistência e nova consulta por ID; payload com tenant forjado não muda organização; outra organização recebe 404 |
| Agendamento | Criação vinculada ao cliente, atribuição, desatribuição/reassociação, confirmação e nova consulta persistida; vínculo entre organizações é rejeitado |
| O.S./execução | Abertura vinculada a cliente/agendamento, nova consulta dos vínculos, início e conclusão pelos endpoints; operações de outro tenant rejeitadas |
| Cobrança/pagamento | Cobrança pendente vinculada à O.S.; valor parcial/excessivo rejeitado sem mutação; recebimento manual exato, repetição da mesma chave e disputa entre duas chaves geram um único pagamento/evento por cobrança |
| Indicadores | Duas liquidações somam 38000 centavos e dois recebimentos no dashboard; O.S. sem cobrança produz alerta, cobrança paga sai das exceções esperadas |
| Histórico | Ações do percurso persistidas; pagamento com pessoa, entidade e data; Timeline HTTP filtrada por ação/pessoa retorna o evento com nome do ator e outra organização recebe lista vazia |
| Auditoria | CUSTOMER_CREATED consultado por ação, entidade e pessoa: usuário/pessoa, nome do ator e horário válidos; filtro idêntico de outro tenant não expõe evento |
| Organização | ADMIN altera nome, nova leitura confirma persistência; VIEWER real recebe 403 ao tentar editar; nome original restaurado e reconsultado |
| Governança | Recalcular estado via endpoint persiste risco/data no percurso; suíte separada confirma uma transição entre instâncias e rollback de estado quando a evidência falha |
| Exportações | 14 cenários existentes confirmam recorte por cliente, papéis, isolamento, no-store, autoria e bloqueio de liberação sem auditoria |

## Comandos e evidências

- `pnpm --filter ./apps/api exec jest --config jest.config.js --runInBand` com `canonical-operational-workflow.spec.ts`, `gaps-financial-integrity-postgres.integration.spec.ts` e `privacy-exports-postgres.integration.spec.ts`: **21 testes passaram**. [Log final](operational-revalidation-evidence/workflow-finance-privacy.txt).
- Governança foi inicialmente ignorada pelo guard específico; não se alterou o guard. Criado banco local novo com nome exclusivo `governance_state_test_<sufixo>`, aplicadas migrations e executado o arquivo `governance-state-change-postgres.integration.spec.ts` com `RUN_REAL_GOVERNANCE_STATE_INTEGRATION=true`: **dois testes passaram**. [Migrations](operational-revalidation-evidence/governance-migrations.txt), [testes](operational-revalidation-evidence/governance.txt).
- `pnpm --filter ./apps/api typecheck`: passou. [Log](operational-revalidation-evidence/types.txt). Comandos via `npx --yes pnpm@10.30.3`.
- `git diff --check`: passou. Não se repetiram lint/build de produto nesta mudança apenas de teste/documentação.

A primeira bateria foi executada antes da ampliação das asserções e a bateria final foi repetida após os novos checks de persistência, histórico e organização. Todos os resultados finais acima passaram.

## Limites e dados

HTTP/Nest/JWT e persistência reais no teste canônico, sem navegador nesta etapa. Não equivale a login visual, reload de página ou nova sessão do navegador; são novas requisições de leitura e consultas persistidas. Os JWTs são assinados para fixtures reais pela suíte, sem passar pela tela de login.

O financeiro usa liquidação manual fictícia com método PIX como registro local, sem transferência externa. Fixtures de webhooks Stripe são assinadas/simuladas localmente: não há checkout, estorno ou conciliação em sandbox externo. WhatsApp confirma persistência de mensagem de confirmação/recibo, com provider mock e schedules de envio desativados: não prova entrega ou mensagem recebida na caixa. A suíte dedicada de Governança usa serviços com PostgreSQL real e colaboradores simulados; não cobriu visualmente avaliação ausente nem todos os perfis da tela.

Fixtures de organizações/usuários/clientes e relações foram removidas pelos testes; alteração de nome foi restaurada antes do cleanup. O banco de Governança criado nesta etapa fica preservado, assim como os volumes. Containers locais iniciados para esta rodada foram encerrados ao terminar. Nenhum reset, deploy ou mensagem externa.

## Pendências após esta etapa

- AU08 parcial: motor genérico de regras ainda não entregue; apresentação comercial corrigida.
- AU11 parcial: responsável/canal, identidade, retenção e ciclo de entrega aprovados ainda não comprovados.
- AU12 parcial: recuperação local tem evidências; faltam definições de responsáveis/objetivos e prova real offsite/alerta.
- Permanecem testes de carga, sandbox de provedores, teclado/leitor de tela em dispositivos reais e verificações de interface não repetidas nesta rodada. O percurso HTTP aprovado não encerra essas pendências.
