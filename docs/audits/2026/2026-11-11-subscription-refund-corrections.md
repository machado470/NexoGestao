# Assinaturas e estornos — correções de 11/11/2026

## Base e escopo

Raiz `/workspace/NexoGestao`, branch `fix/auth-email-e-validacao`, base `68fbf1ff1fcb480b4370091dc3ef7e74f65f7caf`. As alterações locais anteriores de autenticação foram preservadas. Nenhum commit, push ou deploy foi realizado. PostgreSQL e Redis locais, organizações e dados fictícios; nenhum pagamento ou mensagem foi enviado a provedor externo. As evidências desta etapa ficam em [financial-fix-evidence](financial-fix-evidence/).

## Achados tratados

| Achado | Status | Mudança e verificação |
| --- | --- | --- |
| AU01 — ativação após checkout sem confirmação | Corrigido no escopo exercitado | Billing consulta a assinatura atual no provedor e usa seu estado e período. Checkout pendente de uma organização sem assinatura recebe plano FREE; upgrade pendente não substitui a assinatura existente. Testes unitários e PostgreSQL cobrem pendência, confirmação posterior e ausência de concessão antecipada de plano pago. |
| AU02 — eventos antigos alterando estado novo | Corrigido no escopo exercitado | Reconciliação serializada por organização, consulta atual ao provedor, deduplicação após lock e marca temporal. Uma invoice antiga não reativa assinatura cancelada; associação a outra assinatura é protegida contra checkout antigo. Testes de duplicidade e concorrência usam PostgreSQL real. |
| AU07 — estorno ignorado | Corrigido para estornos confirmados e sua reversão | Webhooks consultam o estado atual do refund e PaymentIntent. Ledger persistente, deduplicação, limite pelo pagamento original, isolamento entre organizações, Timeline/Auditoria atômicas. Falha/cancelamento posterior registra reversão; não apaga o estorno original. Testes unitários, PostgreSQL, HTTP/BFF e Chromium. Disputas/chargebacks e conciliação bancária continuam fora da cobertura. |

### Arquivos e contratos

- Assinaturas: `apps/api/src/billing/billing.service.ts`, `billing.service.spec.ts` e `billing-reconciliation.spec.ts`. Timeout explícito de 5 segundos por consulta ao provedor, sem retries internos; transação com timeout de 15 segundos. Lock `FOR NO KEY UPDATE` serializa reconciliações sem bloquear inserts normais que referenciam a organização. Checkout produz ajuste de valor zero; invoice mantém o registro financeiro correspondente, evitando contabilizar o checkout como segundo pagamento.
- Estornos: `apps/api/src/payments/payments.service.ts`, `payments-refunds.webhook.spec.ts`, `apps/api/src/finance/payment-refunds.service.ts` e `finance.module.ts`. Assinatura Stripe validada antes da consulta ao provedor. `charge.refunded` percorre a lista paginada completa. Refund anterior à liquidação local gera erro para nova tentativa, sem confirmação silenciosa. Eventos pendentes não reduzem os totais.
- Persistência: `prisma/schema.prisma` e quatro migrations aditivas: `20261111163000_billing_event_watermark`, `20261111164000_payment_refunds`, `20261111213000_refund_payment_tenant_fk`, `20261111215000_refund_reversal`. FK composta impede vincular estorno a pagamento de outra organização; valor positivo e identificador único do refund ficam protegidos no banco. Aplicadas somente aos bancos locais de teste. Devem preceder a API atualizada em uma implantação futura.
- Leituras: `apps/api/src/common/finance/refunded-amount.ts`, serviços Finance, Dashboard, Expenses e Customers; schemas BFF em `apps/web/server/routers/{finance,dashboard}.ts`; páginas `FinancesPage`, `ExecutiveDashboard` e `finance-modes/FinanceReports`. Contratos de valores brutos mensais/semanais permanecem; campos de estorno e líquido são aditivos. A interface prefere o líquido quando disponível. Campos de período podem ser negativos: uma reversão pertence ao período em que foi conciliada.
- Histórico: `apps/api/src/timeline/timeline-events.ts` e `apps/web/client/src/lib/presentation-labels.ts`; eventos `PAYMENT_REFUNDED` e `PAYMENT_REFUND_REVERSED`, ator de sistema/provedor explícito, entidade pagamento e vínculo com cliente/cobrança/O.S. quando existente. A reversão usa a data de conciliação local conhecida; não inventa data de liquidação bancária.
- Cache: revisão compartilhada no banco considera quantidade de refunds e reversões, invalidando valores financeiros também entre instâncias. A soma de débitos e créditos usa uma única consulta SQL parametrizada para manter o mesmo snapshot.

O pagamento original permanece íntegro. Uma cobrança quitada permanece PAID e com saldo devedor zero após estorno. A reversão recompõe o recebido líquido, libera capacidade para outro refund e não admite reconfirmação silenciosa do mesmo identificador revertido.

## Validação

O teste `apps/api/test/integration/payment-refunds-postgres.integration.spec.ts` contém 14 cenários reais de PostgreSQL: estorno parcial/total, repetição, oito entregas concorrentes entre instâncias, disputa pelo limite, moeda divergente, tenant incorreto, FK física, rollback de histórico, totais líquidos, invalidação de cache, reversão repetida/concorrente, períodos distintos, assinatura pendente/confirmada, lock sem bloquear cadastro normal e invoice antiga. Leituras Stripe são simuladas; a verificação de assinatura usa o SDK com assinatura de teste.

O roteiro HTTP/BFF/Chromium usa pagamento fictício de R$ 100,00, estorno de R$ 25,00 e recebido líquido de R$ 75,00. Confere cobrança quitada, saldo zero, deduplicação, Auditoria, Financeiro e Dashboard. Após reversão, conferiu o recebido líquido de R$ 100,00 e uma única ocorrência de reversão. O pagamento e o estorno entram por fixture/serviço interno real; não por checkout Stripe externo. A organização QA recebe uma avaliação sintética temporária para exibir o Dashboard, removida ao terminar, junto com os demais registros próprios. Nenhum dado compartilhado é apagado.

| Comando/verificação | Resultado |
| --- | --- |
| `npx --yes pnpm@10.30.3 test` | Passou: API 1.230, web 798, common 4 = **2.032 testes**; API 124 cenários condicionais ignorados na execução padrão. |
| `RUN_REAL_INTEGRATION=true DISABLE_OPERATIONAL_STATE_SCHEDULE=true ... jest --runInBand test/integration/ --testPathIgnorePatterns phase23c-` | Passou: **122 testes**, 24 suítes; 20 ignorados por guards de infraestrutura/escopo. Inclui os 14 cenários novos financeiros. Não somar aos 2.032 como casos todos distintos. |
| `npx --yes pnpm@10.30.3 build` | Passou nos três pacotes. Avisos não bloqueantes de bundle/anotações de dependência constam no log. |
| `npx --yes pnpm@10.30.3 -r typecheck` | Passou. |
| `npx --yes pnpm@10.30.3 --filter @nexogestao/web lint:os` | Passou: validador de padrões existente. Não há lint geral de TypeScript adicional nesta configuração. |
| `npx --yes pnpm@10.30.3 lint` | Falhou antes do validador: wrapper PNPM interno tentou baixar `pnpm-10.30.3.tgz` e recebeu ECONNREFUSED do registry. O validador equivalente acima passou. Retry com configuração de ambiente também não eliminou o download e foi interrompido após confirmar a mesma tentativa; não constitui resultado de lint. |
| `npx --yes pnpm@10.30.3 prisma:check` | Passou sequencialmente após o build: schema válido e client gerado alinhado. Uma tentativa anterior paralela à geração falhou por marcador temporário; não se comprovou defeito do schema. |
| `DATABASE_URL=<banco local> ... prisma:check:drift` | Passou: **No difference detected** após as quatro migrations. |
| HTTP + BFF + Chromium | Passou; [resultado estruturado](financial-fix-evidence/browser-result.json), [Financeiro](financial-fix-evidence/refund-finance.png), [Dashboard líquido](financial-fix-evidence/refund-dashboard.png), [Dashboard após reversão](financial-fix-evidence/refund-reversed-dashboard.png). Nenhum pageerror. |

A primeira execução ampliada teve 121 testes aprovados e um falho: o cron `OperationalStateJob` executou exatamente durante a comparação de Timeline no teste WhatsApp. O log mostra `evaluated=2 changed=2`; o teste e o scheduler não foram alterados nesta etapa. O arquivo do teste coincide byte a byte com HEAD. Com a opção existente de isolamento `DISABLE_OPERATIONAL_STATE_SCHEDULE=true`, os 122 passaram. Isso confirma interferência temporal neste ensaio, sem evidência de regressão financeira. A flag foi usada apenas na execução local; o teste WhatsApp continua merecendo isolamento permanente em outra correção. Nenhuma assertion foi relaxada.

As migrations foram executadas nos bancos locais `nexo_visual_integration_test` e `nexo_capacity_test`, sem reset, remoção de volumes ou alteração de históricos Git. Dados temporários próprios foram removidos pelo roteiro; serviços e containers iniciados para esta validação foram encerrados ao terminar, preservando os volumes.

## Limites e próximos passos

Não foi exercitado checkout hospedado, pagamento, estorno ou entrega de webhook em sandbox Stripe externo. Prorrateio, duas assinaturas externas ativas, disputas/chargebacks e liquidação bancária precisam de cobertura própria. Consulta ao estado atual reduz problemas de ordem de eventos; indisponibilidade do provedor exige repetição do webhook. Esta etapa não certifica todo o ciclo comercial nem substitui ensaio de implantação das migrations com volume real.

O percurso completo Cliente → Agendamento → O.S. → Cobrança não foi repetido pelo navegador nesta etapa. Foram exercitados pagamento/estorno → totais → Histórico/Auditoria e seus vínculos em dados fictícios. As demais rotinas contam com a suíte de regressão, distinguida da execução manual descrita acima.

Restam sete achados originais: AU03 (medidores comerciais compartilhados), AU04 (política uniforme de assinatura), AU06 (revogação de streams ativos), AU08 (motor genérico de automações), AU11 (ciclo de privacidade), AU12 (recuperação operacional) e AU13 (teclado telefônico). AU05/AU09/AU10 estão documentados na [etapa de autenticação](2026-11-11-auth-email-corrections.md). Nenhuma alegação de correção destas sete áreas é feita aqui.

Atualização posterior: AU04 recebeu a [correção de acesso por assinatura](2026-11-11-commercial-access-corrections.md). A lista de sete pendências acima é histórica desta etapa; a auditoria consolidada passou a ter seis.
