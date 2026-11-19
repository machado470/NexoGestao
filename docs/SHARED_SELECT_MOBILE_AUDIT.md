# Seletores compartilhados no celular

Os campos e opções do Select compartilhado ainda tinham texto de 14 px e opções pequenas fora do alcance das regras das páginas. O texto interno de nomes longos podia extrapolar a largura da opção e ser cortado, mesmo com a lista dentro da tela.

No celular, o campo e as opções passam a usar 16 px e altura mínima de 44 px. Em desktop, as dimensões compactas existentes permanecem. A lista respeita a largura disponível informada pelo Radix; o texto interno das opções pode encolher e quebrar palavras longas. Opções e foco usam a cor do texto do portal para manter contraste no tema claro e escuro. Nenhum valor, contrato ou comportamento de seleção foi alterado.

## Validação local

- TypeScript e build Vite.
- `shared-select-mobile.cjs`: Chromium com fixtures em 320 px/escuro, 390 px/claro e 1280 px/claro. Campo/opções com geometria móvel e fonte esperadas; foco das opções com contraste >=4,5:1; lista dentro da tela; doze responsáveis com nomes longos, inclusive palavra sem espaços; texto inteiro dentro da opção, sem overflow; última opção alcançada e selecionada por End/Enter; valor escolhido mantido sem alargar a página.
- Financeiro: selecionar Pagas filtra a cobrança pendente e retornar a Todos restaura a carteira. O.S.: filtrar por responsável sem ordens e limpar restaura o recorte.
- Regressão `mobile-customer-to-payment.cjs`: cadastro, agenda, O.S., cobrança, pagamento e edição/continuação escolhida, com respostas locais interceptadas.

## Limites

Nenhum registro real alterado. API de produção e Safari/iPhone real não testados. Os seletores HTML nativos de Clientes/Agenda não foram substituídos; esta mudança trata o Select Radix compartilhado usado nos demais filtros e formulários.
