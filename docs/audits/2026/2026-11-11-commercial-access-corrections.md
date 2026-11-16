# Política de acesso por assinatura — 11/11/2026

## Escopo e resultado

Base `68fbf1ff1fcb480b4370091dc3ef7e74f65f7caf`, branch `fix/auth-email-e-validacao`, raiz `/workspace/NexoGestao`. O trabalho local anterior de autenticação, assinatura e estornos foi preservado. README, manifests, scripts e consumidores da política foram consultados; nenhum AGENTS.md aplicável. PNPM 10.30.3. Sem commit, push ou deploy.

**AU04 — corrigido nos pontos de controle comerciais existentes.** A mesma decisão passa a valer para recursos premium, medidores, quotas de criação e captura de mensagens pendentes pelos workers. Leituras, regularização da assinatura e conciliação de pagamentos do provedor não recebem bloqueio global. Não se transformou esta política em proibição de toda edição de dados já existentes.

**AU03 — pendente.** O consumo dos medidores ainda vem da memória de cada instância. Esta etapa impede que medidores ignorem uma assinatura restrita, mas não torna seu consumo persistente nem atômico. Isso requer ledger/reserva por tenant, medidor e período, deduplicação e integração transacional com cada efeito. `configurable_automations` continua precisando de uma fonte real de regras configuradas; o motor genérico não possui persistência ativa nesta versão. Não se criou um contador persistente isolado que pudesse divergir da operação cobrada.

## Decisão aplicada

Foi reaproveitada a política restritiva já presente em `canUseFeature`, estendendo-a às demais fronteiras comerciais. Não foi inventada tolerância de inadimplência ou expiração automática de assinatura ACTIVE. Quotas de recursos mantêm os limites do catálogo existente para tenants elegíveis.

| Estado | Novas admissões controladas por quota/medidor e recursos premium | Consultas e regularização |
| --- | --- | --- |
| ACTIVE | Permitidas conforme plano, recurso e demais controles | Mantidas |
| TRIALING com fim futuro | Permitidas conforme plano e demais controles | Mantidas |
| TRIALING vencido, inclusive exatamente no vencimento | Bloqueadas: `tenant_trial_expired` | Mantidas |
| PAST_DUE | Bloqueadas: `tenant_subscription_past_due` | Mantidas |
| SUSPENDED | Bloqueadas: `tenant_subscription_suspended` | Mantidas |
| CANCELED | Bloqueadas: `tenant_subscription_cancelled` | Mantidas |
| Sem assinatura | Fallback FREE existente | Mantidas |

Datas inválidas de trial e estados desconhecidos não autorizam admissão. Falha de consulta à assinatura não é convertida em autorização de criação. A leitura de quotas conserva o fallback FREE; exibir um plano efetivo FREE para uma assinatura restrita não concede automaticamente novas criações dentro desses limites. Overrides de recursos e modo development não ultrapassam a restrição de estado.

## Arquivos e mudanças

- `apps/api/src/common/commercial/subscription-access.ts`: decisão central pura e predicado SQL equivalente para claims atômicos; `CommercialDecision` continua reexportado pelo caminho público anterior.
- `apps/api/src/common/commercial/commercial-policy.service.ts`: recursos, todos os medidores e resumo administrativo usam a decisão central. O resumo passa a contar trial vencido como bloqueado. Nenhum valor do contrato de assinatura foi traduzido ou alterado.
- `apps/api/src/quotas/quotas.service.ts`: plano efetivo e cinco métodos de admissão usam a mesma política. `validateQuota` rejeita antes da contagem/escrita, com mensagem e motivo comercial. Consulta de plano reaproveitada na admissão para evitar duplicar buscas desnecessárias.
- `apps/api/src/whatsapp/whatsapp.service.ts`: claim por ID/BullMQ e claim global/cron consultam o estado da assinatura dentro do mesmo SQL que captura a mensagem. Preserva QUEUED/SENDING, ownership e SKIP LOCKED. Mensagens restritas ficam QUEUED, não FAILED nem apagadas. O cron pode retomá-las após regularização, sem recriar a mensagem ou exigir nova sessão. Entrada de mensagens recebidas não recebe esta restrição.
- `apps/api/src/common/commercial/subscription-access.spec.ts`: matriz de estados, todos os medidores/quotas, trial na fronteira, falha de consulta, leitura, overrides e barreiras de pagamento manual/WhatsApp antes de efeitos.
- `apps/api/test/integration/commercial-subscription-postgres.integration.spec.ts`: HTTP e claims com PostgreSQL real, tenant isolado, regularização e fallback sem assinatura. O claim global é exercitado somente no banco dedicado `nexo_commercial_test`; fora dele a suíte é ignorada explicitamente para não capturar mensagens compartilhadas.
- `apps/web/server/subscription-block-bff.test.ts`: quatro cenários de restrição preservados pelo BFF como FORBIDDEN, sem transformar erro comercial em expiração de sessão.

## Verificações e evidências

| Verificação | Resultado |
| --- | --- |
| `npx --yes pnpm@10.30.3 test` | **2.051 passaram**: API 1.245, web 802, common 4. API ignora 137 cenários condicionais na execução padrão. |
| `RUN_REAL_INTEGRATION=true ... jest --runInBand test/integration/ --testPathIgnorePatterns phase23c-` | **122 passaram**, 24 suítes; 33 ignorados por guards/escopo, incluindo os 13 novos que exigem o banco dedicado. PostgreSQL e Redis locais reais. Rotinas periódicas operacionais/WhatsApp desativadas para isolamento. |
| Suíte dedicada `commercial-subscription-postgres.integration.spec.ts` | **13 passaram**, incluindo quatro estados restritos via HTTP, regularização na mesma sessão, seis estados/validade de trial nos dois claims, ausência de assinatura e isolamento entre tenants. |
| `npx --yes pnpm@10.30.3 build` | Passou nos três pacotes; avisos não bloqueantes de dependência/bundle no log. |
| `npx --yes pnpm@10.30.3 -r typecheck` | Passou. |
| `npx --yes pnpm@10.30.3 --filter @nexogestao/web lint:os` | Passou no validador existente. O wrapper agregado `lint` não foi repetido nesta etapa: a falha de download do PNPM foi documentada na etapa anterior. Não é prova de um lint geral adicional de TypeScript. |
| `npx --yes pnpm@10.30.3 prisma:check` | Passou: schema válido e client alinhado. Executado após o build. |
| `DATABASE_URL=<banco dedicado> ... prisma:check:drift` | Passou: **No difference detected**. |
| Navegador + API + BFF | Passou: cliente existente legível com assinatura suspensa; cadastro recusado em 403 com mensagem visível; sem novo registro; regularização e nova tentativa na mesma sessão; cadastro persistido após recarga. [Resultado](commercial-fix-evidence/browser-result.json), [bloqueio](commercial-fix-evidence/suspended-customer.png), [regularização](commercial-fix-evidence/regularized-customer.png). Nenhum pageerror. |

[Logs e resultados](commercial-fix-evidence/). As contagens de integração são execuções separadas e não devem ser somadas aos testes gerais como se fossem todos casos distintos. Não houve falha nos comandos finais de build, tipos ou testes desta etapa. No roteiro de navegador, as tentativas iniciais corrigiram a fixture (campo de senha e organização com onboarding já concluído) e o seletor da mensagem, que inclui o prefixo do formulário. Esses ajustes não alteraram o produto nem contornaram a restrição comercial.

O banco dedicado foi criado sem reset ou remoção de dados. Recebeu as migrations já existentes no workspace, incluindo as quatro da etapa financeira; nenhuma migration foi acrescentada nesta etapa. Cada teste remove somente seus próprios UUIDs e relações. Os dois containers locais anteriores foram reutilizados e foram encerrados ao concluir, preservando volumes. Nenhum provedor externo foi chamado.

## Limites e próximos passos

A validação do estado ocorre na admissão/captura. Uma mudança de assinatura após um claim e uma chamada externa já iniciada não são canceladas retroativamente. Não existe transação distribuída com o provedor. Esta etapa não comprova revogação instantânea de efeitos já em andamento.

As rotas HTTP de cobrança e pagamento manual continuam com os códigos HTTP existentes de erro comercial (400), enquanto quotas usam 403; os códigos de motivo comercial são preservados. Uniformizar envelopes/HTTP de todo o produto seria outro contrato. O BFF foi verificado para cadastro de cliente; não se afirma navegação manual de todas as telas.

AU03 continua sendo a próxima prioridade: autoridade compartilhada de consumo, período explícito e reservas idempotentes associadas aos efeitos. Além dele, restam AU06 (revogação do stream), AU08 (automações genéricas), AU11 (ciclo de privacidade), AU12 (recuperação operacional) e AU13 (teclado telefônico). São seis achados originais pendentes, além das limitações de sandbox/disputas financeiras descritas na etapa anterior.

Atualização posterior: AU03 recebeu a [correção dos medidores compartilhados](2026-11-11-shared-commercial-meters.md). A lista de seis pendências desta etapa é histórica; a auditoria consolidada passou a ter cinco.
