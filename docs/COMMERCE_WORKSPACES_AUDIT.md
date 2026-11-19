# Estoque, preparação fiscal e saúde financeira

## Escopo entregue

As rotas `/inventory`, `/fiscal` e `/financial-health` aparecem na navegação desktop e no menu Mais mobile para ADMIN. Frontend, BFF e API exigem essa função; os demais perfis continuam sem acesso. Todos os registros são isolados por organização.

- **Estoque:** cadastro com SKU único por empresa, nome, código de barras opcional, variante, mínimo, custo e preço na moeda da empresa. O saldo inicial é zero. Entradas e saídas usam unidades inteiras, motivo obrigatório e vínculo opcional com O.S. da mesma empresa. Transação atômica impede saldo negativo. Repetições com a mesma chave não duplicam movimentos; mudanças de conteúdo nessa chave são recusadas. A lista tem busca e paginação, e o histórico apresenta os últimos 50 movimentos.
- **Notas fiscais:** preparações persistidas com cliente, O.S. opcional, descrição, valor e moeda. A interface informa que não houve emissão e a API retorna `emissionAvailable: false`. Não há autorização fiscal, número, XML, cancelamento ou integração com prefeitura/SEFAZ. A emissão real depende de selecionar um provedor e configurar os dados fiscais da empresa. As faturas comerciais existentes não são tratadas como documentos fiscais.
- **Saúde financeira:** recebimentos, reembolsos válidos e despesas do mês pelo fuso da empresa, separados por moeda. A carteira em aberto e os atrasos usam valores restantes após pagamentos parciais e reembolsos, independentemente do mês escolhido. Resultado dos registros = recebimentos menos reembolsos e despesas; não representa saldo bancário, lucro contábil ou previsão de caixa. Não há conversão cambial.

Despesas novas desta seção registram a moeda vigente da empresa e aceitam repetição idempotente. Despesas antigas não recebem moeda presumida: enquanto houver despesa de moeda desconhecida no período, o resultado fica indisponível. O administrador pode classificar a moeda original explicitamente, sem conversão nem alteração do valor. Despesas sem moeda têm prioridade na lista de até 50 registros. Despesas recorrentes ativas são consideradas uma vez no mês, seguindo a regra existente.

Formulários preservam dados após falha, bloqueiam envio concorrente e pedem confirmação antes de descartar alterações. O cabeçalho empilha texto e ação em telas pequenas.

## Implantação

A migração aditiva `20261119090000_commerce_workspaces` deve rodar antes da nova versão receber tráfego. Ela cria produtos, movimentos e preparações fiscais; acrescenta moeda e chave de repetição opcionais a Expense, índices, restrições e vínculos compostos por organização. Não atribui moeda a despesas históricas.

O arquivo `apps/api/railway.json` já define `pnpm prisma:migrate:deploy` no pre-deploy. Verificar que o serviço da API utiliza esse arquivo. Em execução manual no workspace da API, usar `pnpm prisma:migrate:deploy`; na raiz, `pnpm --filter @nexogestao/api prisma:migrate:deploy`.

Esta entrega não aplicou migração nem realizou testes em produção. O merge e o deploy continuam necessários. A emissão fiscal não é ativada por essa migração.

## Verificação local

- Prisma validate e comparação de schema após aplicar baseline + migração em PostgreSQL 17 isolado: sem diferenças.
- TypeScript da API e web e build Vite aprovados.
- Cinco testes HTTP com PostgreSQL real: isolamento por organização, validação e permissões, concorrência de estoque, repetição, preparação fiscal, despesas, classificação de moeda, fuso mensal, reembolsos e saldos parciais.
- Dezesseis testes do BFF e navegação: restrição por função, validação de contratos e entradas, remoção de identidade forjada e recusa de capacidade de emissão fiscal.
- Auditoria de navegador em 320 px claro, 390 px escuro e 1280 px: navegação, gravações reais locais, perda simulada da resposta após gravar entrada e repetição sem duplicação, rejeição de saída superior ao saldo, preparação fiscal e despesas. Autenticação da auditoria é simulada; isso não valida login real nem Safari em aparelho físico.

Os testes PostgreSQL são opt-in e recusam outra conexão além de `postgresql://nexo@127.0.0.1:55439/postgres`. Com um banco isolado contendo o schema atual, executar no workspace da API:

```sh
COMMERCE_TEST_DATABASE_URL=postgresql://nexo@127.0.0.1:55439/postgres node node_modules/jest/bin/jest.js --config jest.config.js --runInBand src/commerce/commerce.postgres.spec.ts
```

O harness `apps/api/test/commerce-local-api.ts` atende apenas loopback e grava fixtures isoladas para `scripts/audits/commerce-workspaces.cjs`. Não deve ser iniciado em produção. A auditoria exige Vite em 5173, API local em 55440 e Chromium/Playwright disponíveis.

## Próximas fases

Estoque ainda não oferece edição de produto, reservas, compras, lotes, números de série, quantidades fracionárias ou sincronização de marketplaces. O vínculo com O.S. não gera despesa ou cobrança automaticamente. Saúde financeira não inclui conciliação bancária, contas a pagar ou previsão de caixa. Emissão fiscal exige integração própria com tratamento de rejeições e consulta de autorização antes de disponibilizar um botão de emissão.
