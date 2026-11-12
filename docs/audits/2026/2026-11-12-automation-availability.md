# Disponibilidade comercial de automações — 12/11/2026

**AU08 — parcial.** Corrigida a oferta/apresentação das regras configuráveis; não foi implementado o motor genérico. Rotinas dedicadas e controles comerciais existentes permanecem preservados.

## Base e achado

Raiz `/workspace/NexoGestao`, base `70099c03` (PR #1048 integrado), branch `fix/automacoes-disponibilidade-comercial`. Início limpo, sem AGENTS.md aplicável. README/manifests, catálogo, telas, AutomationService e consumidores comerciais consultados. PNPM 10.30.3. Os três checks do PR #1048 passaram durante esta etapa.

O schema não oferece os delegates de regras/execuções; `AutomationService.executeActionJob` e o enfileiramento lançam 503. A página Funcionalidades já dizia “Automações futuras”, mas a comparação pública de planos traduzia `advanced_automation=true` como “Automação avançada” sem ressalva. O entitlement também é consumido por rotinas de execução existentes: desativá-lo globalmente afetaria escopo além do motor genérico.

## Correções

- `apps/web/client/src/lib/billing-plan-catalog.ts`: filtra a oferta de `advanced_automation` na lista comercial de recursos disponíveis, independentemente do entitlement recebido; mantém dados normalizados, preço, limites e demais features. Texto compartilhado explica que regras/gatilhos personalizados ainda não estão disponíveis em nenhum plano e distingue rotinas específicas de cobrança/WhatsApp.
- `pages/PricingPage.tsx`: aviso antes da comparação de planos, com estilos existentes.
- `pages/BillingPage.tsx`: mesmo aviso usando AppAlert antes das opções de contratação.
- `pages/FunctionalitiesPage.tsx`: deixa a indisponibilidade explícita no cartão de automações futuras.
- `lib/billing-plan-catalog.test.ts`: atualiza a regressão existente para um catálogo que habilita automação e integrações premium; só a oferta indisponível é omitida.

Nenhum contrato API, plano persistido, preço, checkout, quota, override ou rotina dedicada foi alterado. A ressalva é relativa à versão atual do produto; quando o motor for entregue, o filtro e o aviso deverão ser revistos junto da validação de disponibilidade.

## Verificação

- `pnpm --filter ./apps/web test`: **802 testes, 100 arquivos aprovados**. [Log](automation-availability-evidence/web-tests.txt).
- `pnpm exec vitest run client/src/lib/billing-plan-catalog.test.ts client/src/pages/BillingPage.contract.test.ts`: **21 testes passaram** na repetição final focada. [Log](automation-availability-evidence/focused.txt).
- `pnpm --filter ./apps/web typecheck`, `lint:os` e `build`: passaram. [Tipos](automation-availability-evidence/types.txt), [lint](automation-availability-evidence/lint.txt), [build final](automation-availability-evidence/build.txt).
- Chromium com catálogo tRPC fictício contendo `advanced_automation=true` e `premium_integrations=true`: preços em 1440 e 390 pixels exibem aviso e integrações premium, omitem a oferta indisponível e não têm overflow horizontal; Funcionalidades explicita indisponibilidade. Sem erros de página. [Resultado](automation-availability-evidence/browser.json), [desktop](automation-availability-evidence/pricing-1440.png), [mobile](automation-availability-evidence/pricing-390.png).
- `git diff --check`: passou. Comandos PNPM executados via `npx --yes pnpm@10.30.3`. Não se repetiram testes API, pois nenhum fonte ou contrato backend foi alterado.

O primeiro ensaio visual detectou o aviso repetido em três seções da página de preços por uma substituição abrangente; foi corrigido para uma única ocorrência antes dos cards e o navegador repetido com sucesso. Nenhum dado persistido foi criado; o catálogo de navegador é fictício e interceptado no Playwright. A tela autenticada de assinatura foi conferida por código, testes de contrato, tipos e build; não foi exercitada com sessão real nesta etapa.

## Para concluir AU08

Persistência canônica de regras/execuções, executor real, deduplicação, cancelamento e revalidação de ações ainda precisam ser entregues e testados antes de habilitar o motor. Não foi exposto botão para criar regras nem substituído 503 por sucesso fictício. AU11 continua parcial e AU12 permanece pendente; testes externos e carga mantêm suas pendências anteriores.
