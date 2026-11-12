# Privacidade: recorte de exportações e procedimento — 12/11/2026

## Situação

**AU11 — parcial.** Foram concluídas as melhorias independentes de código e a preparação do procedimento manual. O ciclo completo continua pendente de responsável designado, confirmação do canal, critérios de identidade, retenção por categoria, revisão/entrega e tratamento de provedores/backups. Não há exclusão global nem anonimização automática implementada por esta etapa.

Base `d90e274c` (PR #1045 integrado), raiz `/workspace/NexoGestao`, branch `fix/privacidade-exportacoes-e-procedimento`. Workspace limpo ao começar; nenhum AGENTS.md aplicável. PNPM 10.30.3; README, manifests, schema, política pública e fontes operacionais consultados. Os três checks do PR #1045 passaram durante a etapa. Hospedagem e política pública não foram alteradas.

## Correções de código

- `apps/api/src/customers/customers.controller.ts` e `customers.service.ts`: `GET /v1/customers/export?customerId=<UUID>` permite recorte de um cliente, validado no tenant autenticado. Sem parâmetro, preserva o CSV da organização. A consulta lê apenas os campos usados no CSV.
- `apps/api/src/finance/finance.controller.ts` e `finance.service.ts`: mesmo recorte em `GET /v1/finance/charges/export?customerId=<UUID>`, com vínculo de organização também na relação com cliente. A leitura do cliente carrega apenas seu nome para o CSV.
- Ambos mantêm ADMIN/MANAGER e negam STAFF/VIEWER. IDs inválidos/vazios/repetidos retornam 400, ausentes ou de outro tenant retornam 404. Tenant em query/header não substitui a identidade autenticada. Headers de CSV e nomes/colunas anteriores foram preservados; respostas recebem `Cache-Control: no-store`.
- `apps/api/src/audit/audit.actions.ts` e os serviços: `CUSTOMERS_EXPORTED`/`CHARGES_EXPORTED` registram usuário/pessoa autenticados, entidade, escopo, formato e contagem. O conteúdo do CSV não é copiado para metadata. Falha de auditoria impede liberar o CSV pelo fluxo HTTP. É prova de geração, não de entrega/recebimento.
- `apps/web/client/src/lib/presentation-labels.ts`: nomes legíveis dos novos eventos na Auditoria. A autoria inclui `actorUserId`, `actorPersonId` e o vínculo legado `personId`, seguindo o padrão dos outros eventos e permitindo mostrar nome/filtrar pela pessoa.
- `apps/api/test/integration/privacy-exports-postgres.integration.spec.ts`: 14 cenários com HTTP/JWT/PostgreSQL reais. O orçamento de requisições é ampliado somente no módulo de teste para que a bateria de validação/permissões não seja interceptada por 429; os guards de autenticação/papéis continuam reais e a configuração do produto não muda.

Não foi acrescentado autosserviço de solicitações nem seletor de titular no frontend. O recorte REST é destinado aos consumidores/operadores autorizados e está documentado para o procedimento manual.

## Procedimento e inventário

Novos documentos em revisão: [procedimento de atendimento](../../operations/privacy-requests.md) e [modelo de protocolo](../../operations/privacy-request.example.md), catalogados em `docs/index.md` como `review`, sem autoridade normativa aprovada.

Eles cobrem recepção, identificação/representação, inventário, decisão de retenção, minimização/revisão, preparação protegida, aprovação, entrega, eventuais alterações permitidas e encerramento. A matriz inclui cadastro, contas/pessoas, agenda/O.S., anexos externos, financeiro/estornos, Timeline/Auditoria, WhatsApp, notificações, métricas, respostas de idempotência, Outbox, integrações, logs, backups e réplicas. Estados do caso são registros manuais; a API de exportação não consulta um protocolo de privacidade.

A API do workspace não é pacote completo: limita agendas/O.S./cobranças a 50 por categoria e Timeline a 200. Os CSVs não incluem todos os dados do titular. Textos livres, terceiros, conteúdo externo e JSON exigem revisão. Desativar uma pessoa/cliente não remove seus dados. Não foram presumidos prazos legais, responsável, recebimento de e-mail nem descarte de backups. Foi explicitada a preservação de financeiro/auditoria/fatos de consumo antes de qualquer decisão futura de exclusão.

## Validação

| Verificação | Resultado | Evidência |
| --- | --- | --- |
| `npx --yes pnpm@10.30.3 test` | 2080 testes passaram: API 1274, web 802 e common 4; web/common em cache válido na repetição final | [Log](privacy-fix-evidence/all-tests.log) |
| Integração PostgreSQL `test/integration/` | 151 passaram, 33 condicionais ignorados; inclui os 14 novos cenários de exportação | [Log](privacy-fix-evidence/integration-all.log), [14 cenários](privacy-fix-evidence/real.log) |
| Regressão comercial dedicada | 13 passaram; total de 164 execuções de integração nas duas baterias | [Log](privacy-fix-evidence/commercial-regression.log) |
| `npx --yes pnpm@10.30.3 build` | Passou; API recompilada após o ajuste final de autoria | [Build completo](privacy-fix-evidence/build.log), [API final](privacy-fix-evidence/api-build-final.log) |
| `npx --yes pnpm@10.30.3 -r typecheck` | Passou; API repetida após ajuste final | [Tipos](privacy-fix-evidence/types.log), [API final](privacy-fix-evidence/api-types-final.log) |
| `lint:os` do web | Passou; não equivale ao lint agregado de todo o monorepo | [Log](privacy-fix-evidence/lint.log) |
| Chromium + API autorizada + Auditoria BFF + PostgreSQL | Passou: recorte dos dois CSVs, exclusão de outro titular, no-store, eventos legíveis, ator pelo nome e vínculo persistido; sem erro de página | [Resultado](privacy-fix-evidence/browser.json), [captura](privacy-fix-evidence/export-audit.png) |

As verificações desta etapa não repetiram o percurso completo Cliente → Agendamento → O.S. → Cobrança pela interface. O navegador exercitou exportações e Auditoria; a bateria de integração cobriu os contratos e regressões disponíveis. Integrações externas e o procedimento completo de atendimento permanecem pendentes.

Dados fictícios em bancos locais; sem mensagem externa ou operação em produção. O módulo de testes remove somente seus UUIDs e registros relacionados. As primeiras tentativas mostraram interferência do limite por IP no lote de requisições e dependências de fixtures geradas durante a execução. O módulo de teste ganhou orçamento próprio e cleanup após encerrar a aplicação, incluindo relações próprias. Fixtures anteriores do ensaio foram removidas por seus IDs e recorte temporal; volumes preservados. Nenhuma assertion de 401/403/isolamento foi relaxada.

A primeira checagem visual também mostrou autoria gravada só com usuário, aparecendo como “Ator não identificado”. O evento passou a incluir a pessoa autenticada e a verificação foi repetida. No código de produção, os limites HTTP permanecem iguais.

## O que falta para concluir o AU11

1. Responsável e substituto reais, com critérios de identidade/representação e atuação contratual definidos.
2. Canal de privacidade comprovado por recebimento/resposta pelo responsável autorizado; esta etapa não enviou e-mails de teste.
3. Matriz de retenção e eventuais impedimentos legais aprovados por categoria; plano de anonimização/exclusão por vínculos, terceiros e arquivos externos.
4. Exercício de solicitação completo com protocolo restrito, revisão, canal de entrega aprovado, prova de recebimento e descarte do pacote temporário conforme decisão registrada.
5. Tratamento e prova de execução em provedores, observabilidade, backups e restauração futura.

Não se declara conformidade legal ou ciclo encerrado apenas por haver exports/testes. Permanecem três achados originais: AU08, AU11 (parcial) e AU12. Verificação nativa iOS/Android, testes de carga, sandbox financeiro externo e configuração de Pages continuam com as pendências registradas anteriormente.

## Acompanhamento do CI após publicação

O PR #1046 foi integrado, mas os dois quality-gates falharam na limpeza da suíte SSE, apesar de seus 151 testes passarem. Compose passou. O [diagnóstico e correção da limpeza](2026-11-12-notification-test-cleanup.md) registra a reprodução, o isolamento do agendador e a nova validação local. Os resultados locais acima permanecem válidos para os comandos e ambiente registrados; não representam aprovação daquele CI.
