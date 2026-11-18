# Navegação dos formulários de Agenda, Calendário e O.S.

## Alteração

Os formulários já protegiam o fechamento por botão, Escape e clique fora, mas não registravam bloqueio da navegação interna/Voltar. Um rascunho podia desaparecer ao sair pelo histórico do navegador.

A criação/edição de agendamento na Agenda, a criação pelo Calendário e a criação de O.S. agora ativam `guardNavigation` no hook compartilhado de descarte. Cancelar a confirmação mantém o formulário e a entrada de histórico atual; confirmar descarta e continua para o destino original. Durante gravação, o bloqueio já informado por cada formulário também se aplica à navegação SPA. Salvar continua seguindo o fluxo de confirmação existente, sem nova mutation ou mudança de dados/regras operacionais.

## Validação local

- 20 testes de contratos de Agenda, responsáveis e interface/contrato operacional de O.S.
- TypeScript e build Vite.
- `scripts/audits/operational-form-navigation.cjs` em 320/390 px com Chromium e respostas interceptadas: entrada pelas opções reais da navegação; Voltar com continuar editando, Escape na confirmação e descarte; observações/título preservados; comprimento do histórico preservado; Avançar reabre formulário limpo; nenhum POST durante navegação/descarte e nenhum erro de página/overflow horizontal.
- Edição de agendamento existente: hora 09:00 da empresa preservada; Voltar não perde a observação ao continuar; descarte e retorno pelo histórico recuperam os dados originais da fixture, sem gravação.
- Regressão `operational-save-recovery.cjs`: Agenda/O.S. mantêm campos após rejeição, bloqueiam envio duplo imediato e confirmam antes das leituras lentas; ações de avisos antigos não reenviam dados anteriores.

## Limites

Fixtures locais, sem registros de produção alterados. API real e Safari/iPhone não testados. Rascunhos ficam na memória do formulário; não há persistência nova. O bloqueio usa o histórico gerenciado da aplicação; a saída para outro documento segue a proteção nativa existente e depende do navegador.
