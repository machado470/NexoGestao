# Medidores comerciais compartilhados — 11/11/2026

## Resultado e ponto de partida

**AU03 — corrigido nos pontos ativos que já tinham medição comercial.** Consumo e admissão deixam de depender de `TenantOperationsService.snapshot()`. Usam fatos persistidos e reserva dentro da mesma transação que grava o efeito admitido. Não foi criado um segundo contador que precisasse de compensação após falhas.

Raiz `/workspace/NexoGestao`, branch `fix/auth-email-e-validacao`, base `68fbf1ff1fcb480b4370091dc3ef7e74f65f7caf`. `git status --short --branch` confirmou as alterações locais anteriores; elas foram preservadas. README, manifests, scripts e consumidores foram consultados. Nenhum AGENTS.md aplicável. PNPM 10.30.3. Sem commit, push ou deploy. Infraestrutura PostgreSQL/Redis local reutilizada conforme o skill de ambiente; nenhum provedor externo foi chamado.

## Definição do consumo

A periodicidade do catálogo existente é mensal para planos pagos. Para o medidor de consumo, foi adotado **mês-calendário UTC**, intervalo `[início do mês, início do mês seguinte)`, inclusive para FREE. É uma decisão de implementação explícita, independente da data de emissão da fatura, período do Stripe ou prorrateio. Não se altera o período da assinatura no banco. A API `commercial/context` e o resumo administrativo informam `usagePeriod`.

| Medidor | Fonte compartilhada | Quando consome |
| --- | --- | --- |
| `message_sends` | `WhatsAppMessage` OUTBOUND por `createdAt` | Na admissão persistida da mensagem. Inbound não conta. Retry/replay da mesma mensagem não cria nova unidade. Falha posterior no provedor não devolve a vaga. |
| `finance_critical_actions` | Cobranças criadas + pagamentos sem referência Stripe, por `createdAt` | Criação de cobrança e liquidação manual. Cancelamento/estorno não apaga uma ação admitida. `paidAt` informado pelo usuário não desloca o consumo. Conciliação Stripe continua fora da restrição manual. |
| `automation_executions` | Timeline `EXECUTION_EVENT` com `eventType=EXECUTION_STARTED`; delegate de execução genérica, se disponível | Reserva de início, antes do efeito assíncrono. Uma execução iniciada que falha depois continua contada: liberar antes de conhecer o efeito externo permitiria exceder o limite por repetição. |
| `configurable_automations` | Quantidade de regras persistidas do tenant, sem janela mensal | Configuração armazenada, incluindo regras inativas. O modelo genérico não existe nesta versão: resumo mostra zero com `meterAvailability=false`; tentativa de usar esse medidor recebe `commercial_meter_unavailable`. Não confundir com zero execuções nem com recurso liberado. |

Registros anteriores da janela já entram na contagem: não há reset inicial no deploy nem backfill de contadores. Valores inválidos nos limites JSON (negativos, fracionários, não finitos) voltam ao limite canônico existente. Limite zero é válido e impede admissão. Os números do catálogo não foram alterados.

## Como a admissão fica atômica

O PostgreSQL mantém um advisory lock transacional por tenant e medidor. Depois de adquirir o lock, a política lê assinatura/limite/consumo do banco e a própria transação grava a mensagem, cobrança, pagamento ou reserva de execução. Outra instância aguarda e observa o registro já confirmado antes de admitir a próxima operação. O lock não inclui o mês, evitando separar admissões que atravessam a virada da janela.

Uma falha anterior ao commit desfaz o efeito e libera o lock sem exigir decremento compensatório. Uma queda depois do commit mantém o registro e seu consumo. Reiniciar o serviço não zera os fatos. Restrições de assinatura da etapa AU04 são revalidadas na admissão transacional. Os controles técnicos de frequência continuam separados.

WhatsApp verifica a chave novamente sob lock; duas entregas concorrentes da mesma chave geram uma única mensagem e um único job. No financeiro, replay da idempotência retorna antes de nova gravação, e pagamento já liquidado retorna antes de nova admissão. A conciliação do provedor usa o caminho de serviço existente e continua disponível mesmo com o medidor manual cheio.

## Arquivos alterados nesta etapa

- `apps/api/src/common/commercial/commercial-policy.service.ts`: fontes persistidas, leitura por janela, lock/admissão transacional, limites válidos, disponibilidade de configuração e inicialização idempotente da assinatura FREE. A assinatura pública do construtor e os retornos anteriores foram preservados; período/disponibilidade são aditivos. O parâmetro de telemetria permanece compatível, mas não decide consumo.
- `apps/api/src/commercial/commercial.controller.ts`: publica a janela de consumo no contexto comercial.
- `apps/api/src/whatsapp/whatsapp.service.ts`: admissão e criação da mensagem na mesma transação, deduplicação sob lock; postagem do job mantém o fluxo de recuperação existente após commit.
- `apps/api/src/finance/{finance.controller,manual-payments.service,finance.service}.ts`: callback interno de admissão transacional nos pontos manuais já medidos. O callback é fornecido pelo servidor, não pelo DTO/cliente. Contrato de reconciliação do provedor preservado.
- `apps/api/src/execution/execution.runner.ts`: reserva comercial junto ao `EXECUTION_STARTED`; bloqueio registrado com motivo comercial sem executar o efeito.
- `apps/api/src/automation/automation.service.ts`: caminhos de configuração/execução do delegate genérico, quando disponível, também usam admissão transacional. Esta etapa não cria modelos nem habilita esse motor: a indisponibilidade atual continua explícita, ligada ao AU08.
- `prisma/schema.prisma` e migration `20261111233000_commercial_message_usage_index`: índice `(orgId, direction, createdAt)` para o novo recorte de mensagens. Demais fontes já possuem índices de tenant/data ou tenant/ação/data. Aplicada somente aos bancos locais desta validação.
- Testes de política/assinatura, WhatsApp e concorrência de execução: doubles atualizados para refletir a nova fronteira transacional. Novos testes em `commercial-usage-period.spec.ts` e `test/integration/commercial-meter-postgres.integration.spec.ts`.

## Verificação

| Verificação | Resultado |
| --- | --- |
| `npx --yes pnpm@10.30.3 test` | **2.055 passaram**: API 1.249, web 802, common 4. API ignora 145 testes condicionais na execução padrão. |
| `RUN_REAL_INTEGRATION=true ... jest --runInBand test/integration/ --testPathIgnorePatterns phase23c-` | **130 passaram**, 25 suítes, incluindo os oito cenários novos. 33 ignorados por guards/escopo; infraestrutura real PostgreSQL/Redis, cron operacional/WhatsApp desativado para isolamento. |
| Suíte dedicada anterior de assinatura | **13 passaram** no banco `nexo_commercial_test`: restrições de estado, retomada, consultas e dois claims de envio. Não somar testes de integração aos gerais como se fossem todos casos distintos. |
| `npx --yes pnpm@10.30.3 build` | Passou nos três pacotes. |
| `npx --yes pnpm@10.30.3 -r typecheck` | Passou. |
| `npx --yes pnpm@10.30.3 --filter @nexogestao/web lint:os` | Passou no validador existente. O wrapper agregado com download do PNPM não foi repetido nesta etapa; falha de ambiente registrada anteriormente. |
| `npx --yes pnpm@10.30.3 prisma:check` | Passou sequencialmente após build: schema válido e client alinhado. |
| `DATABASE_URL=<banco dedicado> ... prisma:check:drift` | Passou: **No difference detected**. |
| Navegador + API + BFF | Passou: tenant FREE ativo com 100 ações financeiras já registradas; tentativa pelo modal normal recusada em HTTP 400, mensagem legível, nenhuma cobrança adicional; recarga preservou os registros e nenhum pageerror. [Resultado](meter-fix-evidence/browser-result.json) e [captura](meter-fix-evidence/finance-meter-blocked.png). |

[Logs e evidências](meter-fix-evidence/). O índice foi aplicado nos bancos locais de integração e comercial, sem reset ou remoção de volumes. Registros sintéticos próprios foram removidos. Serviços e containers desta validação foram encerrados ao finalizar, preservando seus volumes. Não houve falha nos comandos finais de build, tipos ou testes; as correções durante desenvolvimento estão descritas abaixo.

Os oito cenários novos de PostgreSQL verificam: oito pedidos disputando a última mensagem entre duas instâncias; replay no limite após recriar o serviço; chave concorrente; períodos/exclusão de inbound e tenant alheio; counters locais sem autoridade; rollback; criação financeira concorrente/idempotência; rollback da liquidação manual e conciliação Stripe independente; reserva de execução antes do efeito; configuração indisponível. Alguns cenários agrupam verificações relacionadas.

Nos testes financeiros de serviço, persistência, Timeline, idempotência e Outbox são reais; analytics e entrega de WhatsApp são doubles. Nos testes de envio, persistência/admissão são reais e a fila é um double, evitando envio externo. O teste de execução exercita a reserva transacional; a execução completa do runner permanece coberta pela regressão existente. Não é teste de carga nem prova de entrega externa.

As primeiras execuções de desenvolvimento detectaram mocks que precisavam representar transações e uma consulta de lock que retornava o tipo PostgreSQL `void`, não desserializado pelo Prisma. A consulta foi corrigida para retornar uma coluna inteira. Nenhuma assertion de segurança, limite ou concorrência foi removida para obter o resultado final. O roteiro inicial de navegador precisou selecionar o botão de envio do rodapé, pois uma opção do formulário tem o mesmo rótulo. Uma fixture própria interrompida foi identificada e removida antes da execução aprovada; nenhum dado compartilhado foi apagado.

## Limites operacionais

Esta correção cobre as fronteiras que já consultavam os medidores comerciais. Não introduz um bloqueio global para todo uso interno de `FinanceService`: os callbacks são aplicados nos pontos de entrada manuais, e a conciliação continua explicitamente fora deles. Importações, fixtures e escritas administrativas diretas não são chamadas de API admitidas por esta barreira; seus registros dentro da janela entram na leitura subsequente.

A autoridade é o registro operacional preservado, não um ledger comercial independente. Uma futura política de exclusão/anonimização deve preservar os fatos mínimos de consumo durante a janela; hoje os módulos examinados não oferecem remoção desses registros na API. Retenção/privacidade continuam no AU11. O lock serializa admissões do mesmo tenant/medidor; desempenho com volume comercial real exige os testes de carga que ainda não foram executados. A migration de índice usa criação normal, devendo ter janela e impacto de implantação avaliados antes de produção.

Continuam pendentes cinco achados originais: AU06 (revogação de stream aberto), AU08 (motor genérico), AU11 (ciclo de privacidade), AU12 (recuperação operacional) e AU13 (teclado telefônico). Sandbox Stripe externo, disputas financeiras e efeitos já iniciados também permanecem com as limitações documentadas nas etapas anteriores.
