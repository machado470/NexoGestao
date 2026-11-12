# Notificações no BFF e percurso visual — 12/11/2026

Base `d38bc5bc`, branch final `fix/notificacoes-prefixo-api`, raiz `/workspace/NexoGestao`; início limpo, sem AGENTS.md aplicável. README/manifests, rotas/formulários, transporte e normalizador de envelopes consultados. PNPM 10.30.3. PR #1059 integrado com os três checks aprovados. Branch inicial de validação visual renomeada após confirmar a falha de produto.

## Falhas confirmadas e correção

A tela fazia requisições BFF cujo transporte já normaliza NEXO_API_URL com `/v1`. Os três helpers de notificações acrescentavam `/v1/notifications`, produzindo `/v1/v1/notifications` e HTTP 404. O teste anterior verificava apenas a presença de uma substring `/v1/notifications`, que também existe no caminho duplicado. [API antes](notification-ui-evidence/api-prefix-before.txt), [regressões antes](notification-ui-evidence/before.txt).

Após corrigir o caminho, o navegador revelou outro problema: a API real retorna `{success:true,data:...}` pelo interceptor global, mas os helpers validavam esse envelope como se fosse o payload direto. O contador BFF retornava 500 apesar do upstream 200. O mesmo contrato afetava listagem e confirmação de leitura; mocks diretos não cobriam isso.

`apps/web/server/_core/operationalNotifications.ts` agora usa caminhos relativos `/notifications...` e o `unwrapNexoApiResponse` existente antes de validar cada payload. Não altera API, sessão/bearer, filtros, identificadores, esquema dos dados ou valores de contagem; erros continuam sendo propagados. `apps/web/server/operational-notifications.integration.test.ts` exige pathname completo, verifica PATCH de leitura e cobre envelopes reais nas três operações, preservando os casos diretos/erro/permissão existentes.

## Resultado no navegador

Chromium desktop 1440×1000, BFF3350/API3340 reais e PostgreSQL/Redis locais, com organização/ADMIN verificado/pessoa/assinatura FREE criados apenas como preparação de teste. Os registros operacionais foram criados pelos formulários. [Resultado estruturado](notification-ui-evidence/browser.json), [execução](notification-ui-evidence/browser.txt), [financeiro após pagamento](notification-ui-evidence/finance-paid.png).

1. Login pela tela, cadastro do primeiro cliente pelo estado vazio e reload confirmando sua presença.
2. Notificação do cliente visível no menu; contador BFF válido; clique para ler persistiu readAt no PostgreSQL e reduziu a contagem em um.
3. Agendamento pelo formulário com cliente/responsável e nova leitura após reload.
4. O.S. criada pela ação contextual do agendamento, com serviço, responsável e valor de R$150; banco confirmou customerId/appointmentId. Reload confirmou O.S. visível.
5. Início e conclusão pelos botões reais, confirmando estados IN_PROGRESS/DONE persistidos.
6. Cobrança vinculada à O.S., com amountCents=15000, pelo fluxo disponível (a harness só aciona geração manual se não houver cobrança automática).
7. Financeiro mostrou A receber=R$150 antes da liquidação; pagamento manual pelo modal, reload mostrou Recebido=R$150. Banco confirmou PAID, um pagamento e um PAYMENT_RECEIVED; a linha deixou de oferecer Registrar pagamento.

Não houve erro de página. As primeiras tentativas da harness foram ajustadas para selecionar conteúdo visível entre layouts responsivos, abrir a ação no menu da linha e usar o texto real com prefixo “Serviço:”; esses eram erros de seletores do teste, não falhas do produto. A execução final acima completou todas as etapas.

## Comandos

- `pnpm --filter ./apps/web test`: **806 testes / 100 arquivos aprovados**. [Log](notification-ui-evidence/tests.txt).
- `pnpm --filter ./apps/web typecheck`, `lint:os`, `build`: passaram. [Tipos](notification-ui-evidence/types.txt), [lint](notification-ui-evidence/lint.txt), [build](notification-ui-evidence/build.txt).
- `git diff --check`: passou. PNPM invocado via `npx --yes pnpm@10.30.3`. Não se repetiram testes API: seus fontes não mudaram; o navegador usou a API compilada validada anteriormente.

## Dados e limites

O pagamento manual registra liquidação fictícia; não transfere PIX nem chama checkout. WhatsApp usa mock e schedules de envio estão desativados. Nenhuma mensagem, e-mail ou pagamento externo. A repetição por mesma chave/concorrência foi exercitada na rodada API anterior; nesta rodada visual foi verificada a ausência da ação após pagar e a unicidade persistida.

Fixtures próprias e relações foram removidas por orgId exclusivo; nenhum registro compartilhado foi editado. Serviços/containers locais iniciados para esta rodada foram encerrados, preservando volumes. A harness temporária com credenciais fictícias não foi versionada. Não houve deploy.

A verificação desktop não substitui teclado virtual nativo, leitor de tela ou auditoria completa mobile. Não foram revalidados todos os estados de WhatsApp/Governança nesta rodada. AU08, AU11 e AU12 continuam parciais pelas dependências já documentadas; a correção de notificações é um achado adicional resolvido neste PR.
