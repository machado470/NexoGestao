# Correções dos nove gaps da auditoria — 2026-11-09

Base: main `6684a222cef558bd5132548d57caaf12cd0b45b4`.

## Entrega

1. **Faturas entre empresas:** criação e alteração verificam customerId no tenant autenticado. As leituras da relação aplicam orgId, protegendo também contra associações históricas inválidas. A nova FK composta `(orgId, customerId)` impede gravações cruzadas diretamente no banco.
2. **Liquidação Stripe:** somente eventos liquidados são processados. Valor recebido e moeda devem corresponder à cobrança; divergência retorna conflito para conciliação, sem simular baixa. A referência canônica do PaymentIntent e a chave idempotente são compartilhadas entre eventos de checkout e charge. externalRef é persistido junto ao pagamento, e uma constraint impede reutilizar a referência no mesmo tenant. Uma segunda cobrança não pode usar o pagamento da primeira. Checkout propaga o vínculo ao PaymentIntent. Eventos sem vínculo operacional são ignorados antes de validar seus dados específicos.
3. **Número de fatura duplicado:** unicidade `(orgId, number)` no banco, com resposta de conflito em criação/edição. O mesmo número continua permitido em empresas distintas.
4. **Descrição/DTO de fatura:** a descrição opcional é persistida como string vazia quando ausente. PATCH usa DTO real com validação em runtime; valores fracionários, overflow e número null são recusados.
5. **Cobranças encerradas:** PAID e CANCELED não aceitam mudanças efetivas em valor ou vencimento. Valores iguais continuam aceitos para compatibilidade. O editor envia somente observações para esses estados, preservando os campos imutáveis.
6. **CSV:** clientes e cobranças usam o mesmo serializador com escape de aspas, delimitadores e quebras de linha. Campos textuais com prefixos de fórmulas são neutralizados; valores numéricos reais permanecem numéricos.
7. **Vencimento duplicado:** transição para OVERDUE e evento são persistidos na mesma transação. Somente a gravação vencedora gera evidência, inclusive com jobs concorrentes. Lembretes periódicos ficam separados do evento de transição. O webhook é despachado após commit.
8. **Resumo de despesas com efeito colateral:** consultar o resumo não grava EXPENSE_RECURRING_APPLIED. O cálculo continua incluindo recorrências, sem afirmar uma materialização que não ocorreu.
9. **Limpeza de observações:** o editor preserva a string vazia intencional; ela chega ao BFF/API e é persistida, permitindo apagar notas antigas.

## Migração e dados históricos

Migração: `20261109170000_enforce_invoice_and_payment_integrity`.

Antes de aplicá-la em um banco existente, executar com DATABASE_URL apontando explicitamente para o alvo:

```bash
node scripts/check-financial-integrity.mjs
```

O script é somente leitura, imprime contagens e retorna saída não zero ao encontrar vínculos de cliente entre tenants, números de fatura duplicados ou referências de pagamento duplicadas. Não imprime dados dos clientes.

A migração faz a mesma verificação dentro de uma transação e bloqueia escritas nas tabelas afetadas enquanto instala as constraints. Se houver inconsistência, aborta sem corrigir dados automaticamente. É necessário reconciliar os registros antes da aplicação. O bloqueio de escrita deve ser considerado na janela de aplicação. A FK de cliente da fatura passa a impedir remoção direta de cliente ainda referenciado, em vez de simplesmente limpar a relação.

O esquema anterior aceitou esses registros; a auditoria não consultou nenhum banco de produção. Não houve migration remota nem alteração de hospedagem.

## Verificação

- API: 150 suítes, 913 testes unitários aprovados.
- Frontend/BFF: 95 arquivos, 769 testes aprovados.
- PostgreSQL descartável: 13 casos em três suítes, incluindo isolamento de faturas, unicidade concorrente, pagamento Stripe assinado/repetido, rollback por referência externa duplicada, vencimento concorrente, limpeza de notas e recusa de dados legados inconsistentes.
- Assinaturas Stripe geradas localmente com o SDK; nenhum pagamento externo foi criado.
- Build dos três workspaces, typecheck de API e web, validador operacional web e git diff --check aprovados.
- Prisma validate aprovado. A comparação schema/banco encontrou drift preexistente: a saída SQL antes e depois desta alteração é idêntica (48 linhas), comprovada em dois bancos descartáveis migrados a partir da main anterior e desta branch. As diferenças antigas em Expense, OperationalActionExecution, OperationalOutboxEvent e tabelas WhatsApp não foram introduzidas nem corrigidas nesta entrega.
- Prova adicional da migração sobre schema legado descartável: três recusas preservaram as constraints antigas e não deixaram índices parciais; um caso limpo foi migrado com sucesso.

## Limites

Conciliação divergente é sinalizada e não liquida a cobrança; esta entrega não cria uma interface de conciliação nem importa pagamentos históricos antigos. Referências externas já gravadas em formato anterior não são reescritas. Despacho de webhook após commit conserva o mecanismo existente, sem uma nova garantia de entrega do provedor. A política de datas do job de vencimento ainda depende do timezone do processo; a auditoria sugeriu revisá-la por organização como melhoria adicional. Não houve validação visual em navegador nesta rodada.

As oportunidades adicionais do relatório (projeção mínima de responsáveis e executor financeiro genérico incompleto) permanecem fora destes nove gaps; não foram anunciadas como corrigidas.
