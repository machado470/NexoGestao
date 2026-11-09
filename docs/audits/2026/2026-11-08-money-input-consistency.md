# Conversão de valores em cobranças e ordens de serviço

## Falha

O formulário de criação de cobrança removia todos os pontos antes de converter o valor: `100.50` virava 1.005.000 centavos (R$ 10.050,00). A edição de cobrança e os formulários de O.S. interpretavam o mesmo texto como 10.050 centavos, mas rejeitavam milhares brasileiros. Esses formulários também permitiam notação exponencial e arredondavam frações excedentes.

## Correção

Os quatro formulários agora usam `parseMoneyInputToCents`:

- Aceita inteiro positivo, decimal com vírgula ou ponto e agrupamentos brasileiros (`1.234,56`).
- Três dígitos após ponto representam agrupamento de milhares: `1.234` significa R$ 1.234,00. Exemplos brasileiros aparecem na prévia do valor.
- Converte os dígitos diretamente para centavos, sem multiplicação e arredondamento em ponto flutuante.
- Rejeita notação exponencial, hexadecimal, sinal, agrupamento inválido, frações excedentes, zero e valores acima do inteiro de 32 bits usado nas colunas monetárias do banco.
- Mantém valor opcional em O.S. quando o campo está vazio; entradas preenchidas inválidas continuam bloqueadas.

Não houve mudança em pagamento manual, que recebe centavos inteiros, nem em contratos de API ou integrações.

## Validação

- Suíte frontend completa: 87 arquivos e 708 testes passaram.
- 36 testes do conversor cobrem entradas equivalentes, centavos pequenos, milhares, limite do banco e valores inválidos.
- Typecheck, build, lint e `git diff --check` passaram.
- Chromium com API, BFF e PostgreSQL reais locais: criação de cobrança com `100.50` persistiu 10.050 centavos; criação de O.S. com `1.234,56` persistiu 123.456 centavos; `1e3` foi bloqueado sem enviar requisição de criação de cobrança.
- Os formulários de edição compartilham o conversor testado, mas não foram exercitados no navegador nesta etapa.
- O script temporário do navegador está em `work/money-browser.cjs`. WhatsApp permaneceu mock; serviços e banco temporários foram encerrados após a verificação.
