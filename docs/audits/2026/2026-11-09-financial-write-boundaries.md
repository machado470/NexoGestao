# Falhas de cancelamento, lembretes e centavos — 2026-11-09

Base: main `7c84006145ea29884a3316ce1f73b6f01046bc16`.

## Falhas e correções

1. `PATCH /finance/charges/:id` aceitava `status:CANCELED` sem motivo e sem gravar os metadados do cancelamento canônico. O editor oferecia esse caminho. A API e o BFF agora recusam esse uso do PATCH. O editor preserva a alteração de observações, inclusive em cobranças canceladas, e direciona o cancelamento para a ação já existente na lista. `POST /finance/charges/:id/cancel` continua sendo a autoridade de cancelamento com motivo, autoria, data e controle de versão.
2. A solicitação manual de lembrete só bloqueava cobranças pagas; as canceladas passavam. O endpoint agora exige PENDING ou OVERDUE. O envio usado por jobs também verifica o estado atual antes de enfileirar o WhatsApp, cobrindo jobs atrasados para cobranças já encerradas. Isso não cancela mensagens que já tenham sido enfileiradas ou entregues por um provedor.
3. DTOs de criação/edição aceitavam números fracionários e valores acima do PostgreSQL Int. Os limites agora são inteiros de 1 a 2147483647 centavos. O serviço repete a validação na criação, edição e geração por O.S., antes de reservar idempotência ou escrever no banco. O BFF de edição aplica o mesmo teto para amountCents.

## Validação

- API: 144 suítes e 871 testes aprovados.
- Web: 95 arquivos e 768 testes aprovados.
- PostgreSQL descartável: quatro casos aprovados, incluindo recusa do PATCH de cancelamento e persistência canônica de motivo, ator, data e auditoria no fluxo correto.
- 51 regressões específicas de limites monetários e FinanceService aprovadas novamente após estender a validação à geração por O.S.
- Checagens de tipos de API e web aprovadas. Compilação da API e bundle web aprovados.
- Validador operacional web e git diff --check aprovados.

Não houve alteração de hospedagem, migration ou acesso a produção. O container descartável foi encerrado após os testes. A checagem de estado antes do enqueue reduz envios indevidos de jobs atrasados, mas não constitui cancelamento transacional de mensagens já existentes no provedor.
