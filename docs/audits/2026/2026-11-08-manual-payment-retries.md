# Pagamento manual: repetição e confirmação

## Escopo

Melhorias no fluxo interno de pagamentos, sem adicionar integrações externas. O backend já possui proteção transacional e idempotência; esta etapa corrige a identidade das tentativas e a comunicação do frontend.

- Valores em centavos exigem dígitos e inteiro positivo seguro; notação exponencial, hexadecimal e frações são rejeitadas.
- A mesma cobrança, valor e método reutilizam a chave de idempotência durante a sessão da página, inclusive após fechar e reabrir o modal. Recarregar a página reinicia esse cache; a proteção transacional do backend continua aplicável.
- Um bloqueio síncrono impede envios simultâneos, inclusive antes de o React renderizar o botão desabilitado.
- A confirmação fecha o formulário antes das consultas de atualização. Falhas nessas consultas geram aviso de atualização indisponível, preservando a confirmação.
- Falhas de transporte preservam os dados e informam que não foi possível confirmar o resultado, pois o servidor pode já ter registrado o pagamento. Rejeições conhecidas do backend mantêm sua mensagem.

## Verificação

- Frontend completo: 84 arquivos, 653 testes passaram.
- Build, typecheck e lint do frontend passaram.
- Recorte do fluxo, contrato e navegação: 36 testes passaram.
- Chromium com API e BFF reais, PostgreSQL 15 e Redis 7 locais, banco temporário migrado. Provedor WhatsApp mock; sem envio externo.
- Valor `1e3` foi rejeitado sem requisição de pagamento.
- Dois submits síncronos produziram uma única requisição.
- A resposta da primeira requisição foi descartada após o commit real. O formulário preservou os dados, e a repetição após reabrir o modal enviou a mesma chave. O banco manteve um pagamento para a cobrança.
- Outra cobrança foi paga e as consultas seguintes receberam HTTP 503. O formulário fechou, a tela exibiu pagamento confirmado com aviso de atualização, e o pagamento permaneceu no banco.
- Resultado: três requisições de pagamento, duas cobranças pagas, dois registros de pagamento.

Os cenários de navegador foram executados por script temporário em `work/`; os testes permanentes de regressão estão junto ao helper e ao contrato da página.
