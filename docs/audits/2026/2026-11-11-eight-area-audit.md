# Auditoria das oito áreas — 11/11/2026

## Escopo, base e critérios

Base local `68fbf1ff1fcb480b4370091dc3ef7e74f65f7caf`, branch `fix/ci-isolar-agendador-fluxo-operacional`, limpa antes desta auditoria. Inclui as correções de capacidade integradas pelo PR #1040 e o ajuste do teste do PR #1041. Raiz `/workspace/NexoGestao`; PNPM 10.30.3, API NestJS, web/BFF React+tRPC, PostgreSQL/Prisma e Redis. Não havia AGENTS.md aplicável. README, arquitetura, scripts/manifests e runbook foram consultados. Documentos arquivados não foram usados como prova de falha atual.

Esta entrega é uma auditoria: não altera código de produção, não faz commit/push/deploy e não executa pagamentos, e-mails ou mensagens em provedores externos. Preserva os dados existentes. Os únicos artefatos novos são este relatório e suas evidências.

P1 = tratar antes de depender comercialmente da capacidade; P2 = próxima onda de confiabilidade/fluxo; P3 = melhoria localizada. Lacuna de operação/produto não equivale a regressão. As reproduções de serviço usam persistência e respostas de provedores simuladas; as integrações separadas usam PostgreSQL/Redis reais. Um payload sintético aceito pelo serviço não demonstra que alguém consiga falsificar a assinatura do Stripe.

## Atualização posterior à auditoria

Os achados AU05, AU09 e AU10 receberam correções locais na primeira etapa: [relatório de correção e evidências](2026-11-11-auth-email-corrections.md). As reproduções abaixo descrevem a base auditada e não devem ser usadas como testes de aceitação da versão corrigida. A etapa seguinte tratou AU01, AU02 e AU07 no escopo de assinatura e estornos: [relatório e evidências](2026-11-11-subscription-refund-corrections.md). AU04 recebeu a [correção da política de acesso por assinatura](2026-11-11-commercial-access-corrections.md). AU03 recebeu a [correção dos medidores compartilhados](2026-11-11-shared-commercial-meters.md). AU06 recebeu a [correção de revogação de streams](2026-11-12-notification-session-revocation.md). AU13 recebeu o [ajuste de teclado telefônico](2026-11-12-customer-phone-input.md), com teste de teclado nativo ainda pendente. Permanecem três achados originais: AU08, AU11 e AU12. As limitações de sandbox externo e disputas financeiras estão explicitadas no relatório da etapa.

## Cobertura das oito áreas

| Área | Evidência atual | Situação |
| --- | --- | --- |
| Empresa nova e onboarding | Revisão do cadastro, e-mail, estado persistido e jornada; testes de onboarding/cadastro | E-mail pode ser informado como enviado após rejeição; entradas HTTP sem DTO concreto podem virar erro interno. Não se completou um cadastro com e-mail externo real. |
| Acessos e permissões | JwtStrategy, guards, administração de membros; integrações de segurança e membros | Revogação HTTP está coberta; stream de notificações já aberto não revalida todos os critérios da sessão. Não se comprovou fuga de dados entre tenants HTTP nesta rodada. |
| Assinatura e planos | Webhooks, assinatura, quotas e política comercial; reproduções de serviços | Ativação sem conferir quitação, eventos fora de ordem e controles comerciais divergentes. Provedor externo não exercitado. |
| Financeiro completo | Finance/Payments/Billing, despesas, cancelamento e regressões existentes | Liquidação manual/cancelamento já possuem testes; estorno recebido do provedor não tem tratamento equivalente no webhook de pagamentos. Conciliação real externa pendente. |
| Automações e notificações | Executor, política comercial, SSE, e-mail; integração Redis entre instâncias | Motor genérico indisponível por decisão explícita; contadores comerciais locais e revogação incompleta do stream. Rotinas dedicadas de cobrança/WhatsApp não devem ser confundidas com o motor genérico. |
| Privacidade e ciclo de dados | Política pública, exportações existentes, desativações e buscas de contratos | Há política e exportações específicas; não se comprovou processo completo de solicitação de titular, retenção e anonimização. Não é parecer jurídico. |
| Mobile e acessibilidade | Chromium 390×844; modal 390×500, rótulos, foco, Escape e overflow | Amostra passou; teclado telefônico ausente no novo cliente. Teclado físico/virtual real e leitor de tela não exercitados. |
| Operação e recuperação | Runbook canônico e scripts de backup/status/restore | Backup local já documentado como comprovado; offsite, alerta entregue, responsáveis e RPO/RTO continuam sem prova/definição no runbook. Não houve acesso ao ambiente de produção. |

## Achados confirmados e correções recomendadas

### AU01 — P1 — Assinatura ativa após checkout sem confirmação de pagamento

**Local:** [BillingService](../../../apps/api/src/billing/billing.service.ts:210), `processCheckoutCompleted`.

O handler recebe `checkout.session.completed`, valida metadata e referência, mas grava `ACTIVE` sem consultar `payment_status`, `mode` ou o estado efetivo da assinatura no provedor. O probe `BILLING_UNPAID` entregou checkout sintético de assinatura com `payment_status=unpaid`; a assinatura local tornou-se `ACTIVE`.

**Impacto:** ativação prematura de direitos caso esse estado chegue pelo provedor; também não se distingue trial de ativação paga nesse handler. O checkout atual oferece cartão, portanto o cenário externo precisa ser confirmado com os meios e estados efetivamente suportados; não foi demonstrado abuso de webhook público.

**Correção:** reconciliar a assinatura autoritativa, mapear trial/incomplete/active e não equiparar conclusão da tela a pagamento. Testar estados pendentes, pagamento confirmado e retries com fixtures do SDK/sandbox.

### AU02 — P1 — Evento antigo pode desfazer estado novo da assinatura

**Local:** [webhook e handlers](../../../apps/api/src/billing/billing.service.ts:169), `processInvoice`/`processStripeSubscription`.

Há deduplicação por `providerEventId`, mas não ordenação/reconciliação entre eventos diferentes. O probe `BILLING_ORDER` aplica cancelamento com `created=300` e depois fatura paga com `created=200`: o estado final volta a `ACTIVE`.

**Impacto:** assinatura pode divergir do provedor após entrega fora de ordem. É distinto de repetir o mesmo evento, caso já coberto por testes.

**Correção:** reconciliar o estado atual do provedor ou manter versão/ordenação adequada por objeto e transação; não usar somente deduplicação. Cobrir cancelamento→fatura antiga, inadimplência→pagamento e troca de referência da assinatura.

### AU03 — P1 — Medidores comerciais dependem da memória da instância

**Local:** [CommercialPolicyService](../../../apps/api/src/common/commercial/commercial-policy.service.ts:311), `estimateUsage`; [contadores locais](../../../apps/api/src/common/tenant-ops/tenant-ops.service.ts).

Os medidores comerciais leem `tenantOps.snapshot()`, baseado em Map local, sem reserva transacional compartilhada ou período de faturamento nesse cálculo. O probe `COMMERCIAL_MEMORY` esgota 300 mensagens em uma instância; outra permite a mesma operação com consumo zero. `configurable_automations` também estima quantidade pelo contador de execuções, não pelas regras configuradas.

**Impacto:** reinício, réplicas e ausência de rotação do contador impedem usar esse consumo como autoridade comercial. Os buckets técnicos compartilhados corrigidos no PR #1040 não resolvem esses medidores.

**Correção:** ledger/contadores persistidos por organização, medidor e período, reserva atômica e quantidade correta por recurso; alinhar catálogo e política antes de definir o período comercial.

### AU04 — P1 — Situação comercial é aplicada de forma diferente entre controles

**Local:** [enforceMeter](../../../apps/api/src/common/commercial/commercial-policy.service.ts:210), [getOrgPlan](../../../apps/api/src/quotas/quotas.service.ts:60), [envio WhatsApp](../../../apps/api/src/whatsapp/whatsapp.service.ts:201).

`canUseFeature` bloqueia `SUSPENDED`/`PAST_DUE`/`CANCELED`; `enforceMeter` só compara consumo. `getOrgPlan` trata cancelamento e trial vencido, mas mantém o plano pago em suspensão/inadimplência. No probe `COMMERCIAL_SUSPENDED`, a feature é bloqueada, o medidor de envio é autorizado e a quota continua PRO. O envio consulta o medidor; a criação de clientes/O.S./agenda consulta quotas.

**Impacto:** a decisão depende do ponto de entrada e permite operações que parecem bloqueadas na política comercial. Não se presume que toda operação deva ser bloqueada: leitura e acesso a dados precisam continuar conforme a política aprovada.

**Correção:** decisão comercial central por estado e ação; explicitar tolerância de inadimplência e acesso permitido. Testar os mesmos cenários na API, BFF e worker.

### AU05 — P1 — Rejeição de e-mail pode ser apresentada como envio bem-sucedido

**Local:** [recuperação de senha](../../../apps/api/src/auth/auth.service.ts:267), [verificação](../../../apps/api/src/auth/auth.service.ts:520) e retorno do cadastro.

Os dois métodos aguardam `resend.emails.send`, mas não conferem o campo `error` da resposta resolvida do SDK. O probe `EMAIL_RESULT` devolve `{data:null,error:{...}}`: cadastro informa `emailVerificationStatus=sent` e recuperação retorna `success=true`; os tokens já foram atualizados no banco.

**Impacto:** usuário aguarda um e-mail rejeitado. Em produção, o exemplo impõe confirmação de e-mail, podendo bloquear a entrada da empresa. Isto é diferente da ausência de configuração, que já é sinalizada.

**Correção:** tratar rejeição retornada pelo SDK além de exceção, preservar mensagens públicas adequadas e permitir reenvio recuperável. Cobrir provedor que rejeita sem lançar, timeout, indisponibilidade e envio confirmado. O EmailService genérico usa outra implementação e já verifica `response.ok`; o problema confirmado está no AuthService.

### AU06 — P1 — Stream aberto não acompanha toda a revogação da sessão

**Local:** [NotificationsController](../../../apps/api/src/notifications/notifications.controller.ts:60), comparado à [JwtStrategy](../../../apps/api/src/auth/jwt.strategy.ts).

A abertura valida a sessão, e o stream revalida periodicamente apenas `User.active`. Mudança de `sessionVersion` após reset de senha, papel ou `Person.active` invalida novas requisições HTTP, mas não essa conexão. O probe `SSE_REVOCATION` confirma a condição consultada e que uma conta ainda ativa mantém o stream aberto. Há fechamento por expiração do JWT; o padrão de duração é sete dias, configurável.

**Impacto:** sessão revogada pode continuar recebendo notificações nessa conexão até expiração/desconexão. Não se observou mistura de tenants: a lacuna é a revogação da conexão existente.

**Correção:** preservar o contexto necessário e revalidar os mesmos critérios do autenticador, ou desconectar por evento de revogação. Cobrir reset de senha, mudança de papel e desativação da pessoa com conexão real já aberta. O probe desta rodada é de controlador com relógio/persistência simulados; não foi o cenário completo de reset sobre SSE real.

### AU07 — P1 — Estorno externo é reconhecido sem reconciliação financeira

**Local:** [PaymentsService.handleWebhook](../../../apps/api/src/payments/payments.service.ts:152).

O handler trata liquidações e registra falha de cobrança; `charge.refunded` não entra em tratamento de estorno. O probe `PAYMENT_REFUND` recebe esse evento e retorna `{received:true}` sem tratamento local. Cancelar cobrança não paga é um fluxo distinto, já existente; não corrige recebimento posteriormente estornado.

**Impacto:** recebido, resultado e histórico podem continuar indicando receita liquidada após estorno no provedor. Chargebacks/disputas também não foram localizados nesse handler.

**Correção:** definir e implementar ledger de estorno total/parcial e conciliação, preservar o pagamento original, idempotência por referência e refletir nos indicadores. Testar sandbox antes de depender de recebimentos externos.

### AU08 — P2 — Motor de automações genéricas ainda não executa ações

**Local:** [AutomationService](../../../apps/api/src/automation/automation.service.ts:304), esquema Prisma e teste `automation.execution-safety.spec.ts`.

O executor e o enfileiramento de ações lançam 503 explicitamente; sem delegates de persistência, a consulta de gatilho retorna `disabled:true`. A página pública já chama o recurso de “Automações futuras”, portanto não foi classificado como regressão ou promessa pública comprovadamente falsa. A política de planos, porém, já contempla `advanced_automation`.

**Correção:** manter disponibilidade comercial/UI coerente; antes de habilitar, entregar persistência, executor, deduplicação e cancelamento/revalidação de ações. Não confundir com automações dedicadas já existentes em Finance/WhatsApp.

### AU09 — P2 — Tipos inválidos no cadastro chegam ao serviço

**Local:** [AuthController](../../../apps/api/src/auth/auth.controller.ts:63), [AuthService.register](../../../apps/api/src/auth/auth.service.ts:122).

O body é interface inline, sem DTO de validação em runtime. `orgName=123` causa TypeError em `.trim()` no probe `AUTH_INPUT`, em vez de erro de entrada controlado. O ValidationPipe global não transforma essa interface em um contrato de classe validado.

**Correção:** DTOs concretos e limites de tamanho/formato para cadastro/login/recuperação. Testar null, arrays, números e campos excessivamente longos pela fronteira HTTP. A reprodução atual é no serviço; a resposta HTTP exata não foi capturada nesta rodada.

### AU10 — P2 — Recuperação distingue contas quando o provedor está ausente

**Local:** [AuthService.forgotPassword](../../../apps/api/src/auth/auth.service.ts:267).

No probe `AUTH_ENUMERATION`, e-mail ausente retorna sucesso genérico; existente retorna 503 quando o provedor não está configurado. A rota tem limitação de requisições, mas a diferença ainda informa existência da conta.

**Correção:** resposta pública uniforme para esse estado, com diagnóstico interno e política de disponibilidade sem enumeração. Cobrir também rejeições retornadas e diferenças relevantes de tempo.

### AU11 — P2 — Ciclo de privacidade não é verificável de ponta a ponta

**Local:** [política pública](../../../apps/web/client/src/pages/PrivacyPolicy.tsx), rotas e serviços de exportação/desativação.

Existem exportações específicas e desativação de pessoas. Não foi localizado procedimento executável/documentado completo para identificar solicitante, inventariar dados, decidir retenção legal, exportar tudo que cabe e anonimizar/excluir com auditoria. A política oferece um e-mail de atendimento, mas a entrega desse canal e o processo manual não foram comprovados.

**Correção:** documentar e testar o processo, inclusive manual quando apropriado; definir retenção por categoria e preservar obrigações financeiras/auditoria. Não implementar exclusão global sem essas decisões. Ausência de autosserviço, por si só, não prova descumprimento legal.

### AU12 — P1 operacional — Recuperação e alerta externo continuam sem prova completa

**Local:** [runbook canônico](../../../docs/operations/production-runbook.md:7), scripts de backup/status/restore.

O runbook registra responsável não atribuído, RPO/RTO não definidos, offsite sem prova e entrega de alerta ausente. Backup/restore local já consta como comprovado; não foi reclassificado como inexistente.

**Correção:** designar responsável, definir objetivos, validar upload/download/checksum/restore e comprovar alerta recebido pelo responsável no ambiente escolhido. Esta é uma dependência operacional; não se alterou hospedagem, instalou cron ou enviou alertas nesta auditoria.

### AU13 — P3 — Telefone sem sugestão de teclado telefônico

**Local:** [CreateCustomerModal](../../../apps/web/client/src/components/CreateCustomerModal.tsx:366).

O DOM do campo `customer-phone` apresenta `type=text` e `inputMode` vazio. A amostra não pede teclado telefônico em dispositivos que o suportam.

**Correção:** usar `type=tel`/`inputMode=tel`, mantendo a normalização de números existente. Validar em iOS/Android reais. Não se inferiu comportamento de teclado físico a partir do Chromium.

## Controles existentes que foram preservados no parecer

- JwtStrategy consulta estado atual e verifica organização, pessoa, papel, sessão e ativação; redefinir senha incrementa `sessionVersion` e consome token atomicamente.
- Administração de membros serializa alterações no tenant, usa versão esperada, protege último administrador e grava auditoria. Integrações passaram.
- Ativação direta de plano está bloqueada com 405; webhook de Billing usa assinatura e deduplicação por ID. AU01/AU02 são lacunas além desses controles.
- Onboarding usa evidência persistida para conclusão, não apenas localStorage; requer cliente, O.S. concluída e cobrança vinculada. O trial de 14 dias existe como método, mas não é chamado no cadastro; como a política pública também oferece conta Free, isto foi deixado como decisão comercial, não registrado como bug comprovado.
- Pagamento manual, prevenção de duplicidade e cancelamento de cobrança não paga possuem testes. AU07 trata outro ciclo financeiro.
- Reports exige autenticação e escopo; `reports:read` é concedido a STAFF/VIEWER na matriz atual. Não se classificou esse acesso como exposição indevida apenas por não ser ADMIN.
- SSE tem isolamento, replay, controle de conexões e expiração; AU06 é específico da revogação posterior.

## Verificações executadas e evidências

1. **424 testes, 44 suítes aprovadas**, de auth, invites, onboarding, membros, assinaturas, Billing, Payments, Finance, política comercial, quotas, notificações, relatórios, automação e despesas. [Log](area-audit-evidence/existing-tests.txt). Executado em `apps/api` com `pnpm exec jest --config jest.config.js --runInBand` e os diretórios citados. Nem todos esses diretórios possuem suíte própria; são contagens do conjunto encontrado.
2. **19 testes, três suítes de integração aprovadas**, auth-security-postgres, organization-members-postgres e notifications-sse, com `RUN_REAL_INTEGRATION=true`, PostgreSQL local 55449 e Redis local 56389/14. [Log](area-audit-evidence/real-tests.txt). Não provam os cenários novos AU01–AU07; estes estão separados nos probes.
3. **Nove probes executáveis confirmaram o comportamento atual**, com persistência e provedores simulados, sem chamadas externas. [Resultados](area-audit-evidence/probes.json), [script](area-audit-evidence/reproduce.cjs). Após compilar a API, executar na raiz `node docs/audits/2026/area-audit-evidence/reproduce.cjs`. O script testa o estado auditado: após corrigir os achados, suas expectativas devem deixar de passar; não é uma suíte de aceitação para perpetuar falhas.
4. **Chromium mobile**: cadastro/login/recuperação em 390×844 sem overflow horizontal, todos os inputs observados rotulados, sem erro de página. Modal de novo cliente em 390×500 ficou entre y=25 e y=475, altura 450, Tab moveu o foco do nome para telefone e Escape fechou. Nenhum cliente foi cadastrado nesse teste. [JSON](area-audit-evidence/browser.json), [cadastro](area-audit-evidence/register-mobile.png), [modal](area-audit-evidence/customer-modal-short-mobile.png), [script](area-audit-evidence/browser.cjs). Não houve axe, leitor de tela, avaliação WCAG completa ou teclado virtual real. A medição inicial capturada durante a transição foi descartada; a medição estável após o resize passou.
5. `node --check` dos scripts e `git diff --check` passaram. Não se repetiram build/tipos/lint de produção porque não há mudança nesses fontes; a API compilada usada é a versão validada na rodada anterior.

Credenciais fictícias de login ficaram fora dos artefatos. O script de navegador lê `NEXO_AUDIT_EMAIL`/`NEXO_AUDIT_PASSWORD` do ambiente e requer Playwright disponível (`NEXO_AUDIT_PLAYWRIGHT_MODULE` opcional). Não usa conta de produção.

## Ordem recomendada

1. AU05 e AU09: entrada da empresa e recuperação de acesso confiáveis.
2. AU01/AU02 e AU07: ciclo de assinatura/pagamento, ordenação e conciliação.
3. AU03/AU04: autoridade comercial persistida e uniforme.
4. AU06: revogação completa das conexões existentes.
5. AU12/AU11: recuperação operacional e ciclo de privacidade, com decisões de responsáveis/retenção.
6. AU08/AU13: disponibilidade de automações e acabamento mobile.

Parecer: o núcleo operacional e os controles HTTP têm evidência útil, mas a auditoria não sustenta afirmar que o ciclo comercial e a operação de produção estejam fechados. Os achados de integração externa exigem testes com sandbox; os de operação/privacidade exigem comprovação e decisões além do código. Nenhum achado foi corrigido nesta entrega de auditoria.
