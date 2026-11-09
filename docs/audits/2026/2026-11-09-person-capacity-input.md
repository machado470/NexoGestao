# Validação de capacidade planejada no editor de Pessoas

## Falha e correção

Apagar uma capacidade existente convertia o campo para `undefined`, omitindo-o do envio. A atualização podia retornar sucesso mantendo a capacidade antiga. A conversão com `Number` também aceitava notação exponencial antes de enviar à API.

O editor agora exige dígitos de um inteiro entre 1 e 100 para capacidades definidas, de acordo com o contrato existente da API. Campo vazio não pode remover silenciosamente uma capacidade; uma mensagem explica a regra antes de qualquer envio. Os controles indicam passo inteiro e exibem orientação junto aos campos.

Uma capacidade legada desconhecida (`null`) pode continuar vazia ao editar campos não relacionados, sem inventar valor padrão. Após um salvamento, a resposta oficial atualiza o cache de detalhe para que reabrir imediatamente o editor apresente os valores confirmados.

Não houve mudança de API, banco ou integração externa.

## Verificação

- Frontend completo: 91 arquivos, 747 testes passaram.
- Dezessete novos casos do conversor verificam limites, dígitos com zeros iniciais, campos vazios, sinais, frações, expoentes, hexadecimal, valores excessivos e preservação de capacidade legada desconhecida.
- Typecheck final, build e lint passaram; `git diff --check` passou.
- Chromium com API, BFF e PostgreSQL locais: apagar capacidade existente bloqueou a gravação e preservou 5 no banco; `1e2` também não enviou atualização. Valores 7 e 3 foram persistidos com uma única requisição. Reabrir o editor mostrou 7 O.S. e 3 agendamentos por dia a partir do detalhe atualizado.
- Script temporário em `work/capacity-input-browser.cjs`. WhatsApp permaneceu mock; não houve envio externo. Serviços e banco temporários foram encerrados após a validação.
