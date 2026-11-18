# Pagamentos parciais e cancelamento no celular

## Problema e alteração

O fluxo de pagamento mantinha a chave da tentativa mesmo depois de receber confirmação. Duas parcelas intencionais de mesmo valor, método e cobrança acabavam reutilizando a chave da primeira: o serviço financeiro pode responder como repetição, sem registrar a segunda parcela.

A chave agora é removida somente após confirmação de `send`. Erros de transporte continuam preservando a mesma chave para repetir a tentativa incerta, inclusive ao reabrir o modal durante a mesma montagem da página. Confirmar um pagamento encerra aquela tentativa; registrar outra parcela gera nova chave. A trava síncrona continua ativa até a consulta posterior terminar.

O cancelamento ganhou trava síncrona contra envios simultâneos; o motivo fica bloqueado enquanto a mutation está pendente e respeita o limite de 1000 caracteres do BFF. Falhas preservam o motivo. O formulário fecha após confirmação, antes das consultas seguintes.

Em 320 px, os avisos de confirmação cobriam ações no rodapé da carteira. Os avisos agora têm botão de fechar com nome acessível em português e alvo de toque de 44 px no celular, sem esconder o texto. O roteiro verifica que é possível dispensá-los e continuar registrando parcelas.

## Verificação local

- 38 testes: fluxo de pagamentos e contratos/navegação da tela financeira.
- TypeScript sem emissão e build Vite.
- `scripts/audits/finance-partial-payment.cjs` com Chromium, respostas interceptadas em 320/390 px: primeiro pagamento persistido com resposta perdida; clique duplo envia uma única chamada; repetição usa a mesma chave e um único registro; nova parcela idêntica usa chave diferente. A carteira devolve R$ 100 recebidos e R$ 50 de saldo para uma cobrança de R$ 150.
- Cancelamento: erro preserva o motivo, campo bloqueado durante envio, clique duplo envia uma única chamada; confirmação fecha o modal com leituras ainda retidas. Falha posterior de consulta mostra recuperação de leitura.
- Regressão `mobile-customer-to-payment.cjs`: cadastro, agenda, O.S., cobrança, pagamento, pesquisa/edição e continuidade opcional.

## Limites

Os valores e estados mostrados continuam vindo das consultas oficiais; o produto não calcula saldo otimista nem altera as regras financeiras da API. Testes de navegador usam fixtures locais e não movimentam dinheiro ou registros de produção. Não validado em Safari/iPhone real. As chaves das tentativas incertas ficam apenas na memória da página; recarregar/desmontar perde esse histórico, e a deduplicação final depende do backend.
