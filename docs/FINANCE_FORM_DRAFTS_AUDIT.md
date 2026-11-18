# Rascunhos dos formulários financeiros

## Comportamento

Pagamento manual e cancelamento usam a confirmação compartilhada de descarte ao fechar, pressionar Escape ou voltar. Alterar somente o método também conta como edição. O saldo oficial pré-preenchido e PIX, sem alterações, não geram confirmação ao fechar. Cancelar a confirmação mantém o valor, método ou motivo digitado. Confirmar o descarte não envia uma operação financeira.

Os dois formulários e a criação de cobrança também registram o bloqueio de navegação SPA. O botão Voltar do navegador mantém a tela e pede confirmação antes de abandonar um rascunho; a navegação só continua após o descarte. Confirmações de sucesso continuam fechando diretamente, sem pedir descarte.

Durante um envio, a navegação SPA fica bloqueada e a proteção `beforeunload` permanece ativa mesmo sem edição prévia. O hook compartilhado agora considera `blocked` além de `dirty` nesse evento. A proteção nativa depende do suporte e da decisão do navegador; não impede que o sistema operacional encerre a aba/aplicativo.

## Validação local

- 38 testes do fluxo de pagamento, contratos e navegação financeira.
- TypeScript e build Vite.
- `scripts/audits/finance-form-drafts.cjs`, Chromium em 320/390 px: fechamento limpo, valor editado, método editado isoladamente, Escape, continuar editando, Voltar do navegador com cancelamento/descarte, ausência de writes no descarte, evento `beforeunload` cancelado durante pagamento sem edição, bloqueio durante envio, motivo preservado após erro e nova cobrança protegida no histórico.
- `finance-partial-payment.cjs`: regressão de parcelas iguais, resposta perdida, cancelamento e confirmação antes das consultas seguintes.
- `form-discard.cjs`: regressão compartilhada de cinco formulários em três larguras. A expectativa antiga de clicar em Cancelar durante um envio de agendamento foi atualizada para verificar o botão desabilitado, comportamento já existente desde a proteção dos salvamentos operacionais.

## Limites

Testes usam respostas interceptadas, sem alterações em registros reais. Não foram testados Safari/iPhone real ou API de produção. O teste de saída nativa verifica o cancelamento do evento, sem automatizar a confirmação nativa de um navegador móvel. Os rascunhos continuam somente na memória: descarte confirmado, recarga autorizada ou encerramento da aba podem apagá-los. Não há nova persistência nem alteração das regras financeiras/idempotência.
