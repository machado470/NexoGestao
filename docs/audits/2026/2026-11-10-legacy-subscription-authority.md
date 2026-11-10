# Auditoria: autoridade nas rotas legadas de assinatura — 2026-11-10

## Falhas reproduzidas

- `PATCH /subscriptions/:planName`, acessível ao ADMIN do tenant, alterava o plano,
  marcava ACTIVE e renovava o período em um mês sem checkout ou confirmação do
  provedor. Podia reativar uma assinatura cancelada ou elevar o plano gratuitamente.
- `POST /subscriptions/cancel` gravava CANCELED localmente mesmo para uma assinatura
  Stripe, sem cancelar no provedor nem registrar o evento financeiro canônico.
- `GET /subscriptions/status` criava um trial na ausência de assinatura e escrevia
  CANCELED para um trial expirado, inclusive gerenciado pelo provedor. Uma leitura
  podia sobrescrever uma confirmação concorrente de pagamento.

Testes de regressão escritos antes da correção: 6 falharam e 1 passou, reproduzindo
ativação sem pagamento e escrita nas leituras. Stripe não foi chamado para a prova.

## Correção e contratos

- Ativação direta no serviço legado retorna 405 com orientação para
  `POST /billing/create-checkout-session`. Não seleciona plano ou escreve no banco.
  A confirmação assinada do provedor permanece sob autoridade do Billing.
- Cancelamento legado delega para `BillingService.cancelSubscription`, incluindo
  cancelamento no provedor, falha sem sucesso local quando o provedor está indisponível
  e registro de BillingEvent. Retorna a resposta canônica do Billing.
- As duas mutações exigem JWT, usuário ativo e ADMIN; o tenant vem da sessão.
- Consultas retornam o registro persistido ou null sem escrever. Um trial expirado
  permanece com seu status persistido; as verificações existentes de quota e de
  recurso comercial avaliam `currentPeriodEnd` separadamente.
- Bootstrap mantém `createTrialSubscription` e seu cliente transacional original.
  Não foram encontrados consumidores web das rotas legadas na busca do repositório.

## Validação

Testes de serviço e HTTP com JWT assinado, estratégia JWT, RolesGuard e ActiveUserGuard
reais; banco e adaptador Billing simulados. Cobrem todos os planos, perfis não
administrativos, tokens ausentes/inválidos/revogados, tentativa de trocar organização,
falha de provedor e consultas sem escrita. Os testes existentes de Billing verificam
cancelamento Stripe e falha do provedor. O teste de montagem da aplicação verifica DI.

Resultado local: 158 suítes / 1.008 testes da API aprovados, TypeScript sem erros,
build dos três pacotes, validador Operating System e `git diff --check` aprovados.

Sem migração ou alteração em dados existentes. Nenhuma chamada real ao Stripe.
