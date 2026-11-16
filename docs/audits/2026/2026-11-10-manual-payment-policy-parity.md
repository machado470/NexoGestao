# Auditoria: paridade nas entradas de pagamento manual — 2026-11-10

## Falha confirmada

`POST /payments/charges/:chargeId/pay` chamava um wrapper que ignorava
`paymentMethod`, usava `actorUserId: null`, não recebia idempotência e retornava
sucesso quando a consulta tenant-scoped não encontrava a cobrança. A rota não
aplicava `OperationalStateGuard`, a política comercial, o limite por organização
nem o throttle explícito presentes na rota canônica `/finance/charges/:chargeId/pay`.
A transação financeira em Finance já era compartilhada; a falha estava na entrada.

## Correção

- `ManualPaymentsService` reúne as políticas de pagamento manual das duas rotas,
  usando o mesmo scope `finance:pay-charge` (30/min por organização), mantendo a
  transação em `FinanceService.payCharge` e contabilizando apenas o retorno exitoso.
- A rota legada aplica os mesmos guards operacionais e throttle explícito (8/min),
  preserva o autor autenticado e aceita o DTO canônico opcional e a chave body/header
  com a mesma precedência da rota Finance.
- `paymentMethod` legado aceita manual/PIX/CASH/CARD/TRANSFER/OTHER sem distinguir
  maiúsculas; manual converte para OTHER. Valores desconhecidos ou conflitantes
  são rejeitados em vez de registrar um método incorreto.
- Body vazio mantém pagamento integral/OTHER. Valor omitido é consultado com
  `id + orgId`; cobrança ausente retorna 404. Envelope de sucesso legado preservado.
- Wrapper público não consumido `markChargeAsPaid` removido para evitar outra
  entrada manual sem política. Webhook Stripe continua usando sua validação de
  assinatura/liquidação e a transação financeira diretamente.

## Validação

Testes HTTP exercitam os dois controllers, RolesGuard, OperationalStateGuard,
ValidationPipe e o serviço de política real; autenticação e persistência simuladas.
Cobrem bloqueios comerciais, limite compartilhado, gerente restrito, perfil sem
permissão, autoria, método, idempotência, conflitos, compatibilidade e cobrança
fora do tenant. Não são testes de sessão JWT nem integração real com Stripe.

Resultados locais: 156 suítes / 986 testes da API aprovados, TypeScript sem erros,
build dos três pacotes e validador Operating System aprovados.

Nenhuma migração de banco ou alteração de infraestrutura.
