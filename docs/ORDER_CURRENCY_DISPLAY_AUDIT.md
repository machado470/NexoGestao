# Moeda registrada na apresentação da O.S.

## Comportamento

Lista e detalhe da O.S. deixam de exibir BRL fixo para valores vindos de orçamento. Consulta em lote resolve moeda pela origem comercial protegida. Mudança da preferência da empresa não relabela o valor aprovado. Resumos da edição também usam a moeda/valor aprovados, incluindo zero.

Para ordens comuns, o valor próprio continua seguindo o contrato legado de entrada em BRL. Quando a ordem não tem valor próprio e o valor mostrado vem de cobrança, usa a moeda registrada na cobrança mais recente. Isso não converte nem reclassifica valores históricos. Ordem comum ainda não tem coluna de moeda própria: criação de O.S. avulsa em outras moedas é uma evolução distinta, não um efeito da preferência global.

Consulta recebe até 500 ids e retorna apenas ordens da empresa autenticada. Moeda de orçamento tem precedência, inclusive em total zero. Não altera o DTO estrito estabelecido de O.S., evitando quebra de versões durante deploy independente. Não há migração ou backfill.

Enquanto a moeda é consultada, a tela informa carregamento; falha mostra indisponibilidade e botão de nova tentativa, sem presumir BRL ou ocultar a fila válida. A chave de cache acompanha a atualização das ordens e das cobranças, evitando reutilizar uma classificação antiga depois de uma edição. Esse marcador fica apenas no BFF/cache; a API recebe ids e deriva a moeda dos seus registros.

## Textos e exportação financeiros

Cobrança, lembrete e confirmação de pagamento usam a moeda do registro financeiro, em vez de BRL fixo. Confirmação diz que houve pagamento referente à cobrança; não afirma recebimento integral do valor original, pois esse texto não consulta o montante de um pagamento específico.

CSV de cobranças acrescenta coluna Moeda após Valor, preservando a identificação em arquivos com múltiplas moedas. Consumidores que dependem da posição das colunas precisam considerar o novo cabeçalho. Não há soma ou câmbio implícito. Mensagens já geradas/enfileiradas não são reescritas nem reenviadas.

## Validação e implantação

- PostgreSQL/Nest: oito cenários da conversão, incluindo lote por empresa, moedas de orçamento, cobrança e contrato legado; ids externos são omitidos, campos forjados/ids inválidos rejeitados.
- Testes financeiros usam fila de WhatsApp simulada, verificando a moeda nos três textos e o CSV; sem envio externo.
- Suítes gerais API: 191 suítes/1323 testes aprovados; web: 124 suítes/972 testes aprovados. TypeScript API/web e build Vite.
- Chromium 320/390/1280 px: orçamento e O.S. USD com preferência visual BRL, falha na leitura monetária, nova tentativa e moeda correta sem fallback; navegação para a origem. Auth/preferências/leituras gerais do módulo são simuladas; catálogo, orçamento, conversão e consulta monetária usam API/PostgreSQL locais reais. A mudança real da moeda da empresa é coberta pela suíte PostgreSQL. Sem Safari físico ou produção.

Auditoria em `scripts/audits/order-currency.cjs`, com Vite e harness local `commerce-local-api.ts`. Banco opt-in `QUOTE_ORDER_TEST_DATABASE_URL=postgresql://nexo@127.0.0.1:55439/postgres`; limpeza restrita às próprias fixtures.

API deve ser publicada antes do novo web para disponibilizar POST /service-orders/currency-context. Sem banco/serviço externo novo. Nenhuma escrita em produção ou mensagem externa nesta validação.

Este incremento corrige apresentação de O.S., os três textos financeiros e CSV. Não implementa câmbio, conciliação ou generalização de todos os relatórios para múltiplas moedas.
