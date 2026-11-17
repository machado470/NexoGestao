# Proteção de edições de Configurações — 17/11/2026

Complementa MOBILE_ACCOUNT_SETTINGS_AUDIT.md: a limitação anterior de navegação interna foi resolvida para Configurações.

Quando há um rascunho alterado, a navegação pelo router Wouter e a ação Sair pedem a mesma confirmação de descarte usada pelo formulário. Continuar editando mantém o rascunho sem executar o destino nem chamar logout. Descartar limpa o rascunho e executa somente o destino confirmado. Durante a mutation de salvamento, essas saídas ficam bloqueadas. Falhar ao salvar mantém o rascunho e a proteção; o sucesso remove a proteção.

O hook de localização do router marca as entradas gerenciadas com um índice em history.state. Em Voltar/Avançar, um listener instalado antes das assinaturas do router restaura a entrada de origem antes de abrir a confirmação, sem desmontar o formulário. O descarte confirmado repete o deslocamento original. Não são criadas entradas extras para impedir a saída. Replace conserva o índice; os demais campos do objeto de estado são preservados. Antes da pessoa editar, navegar continua livre.

A proteção está habilitada apenas em Configurações. Os demais formulários mantêm a confirmação existente ao fechar seus modais. Recarga e navegação entre documentos continuam usando beforeunload; o navegador controla a apresentação dessa confirmação. Não há persistência de rascunho ou garantia contra encerramento forçado do navegador.

Validação local com Chromium e fixtures: cancelar/confirmar troca de área, Voltar e Avançar, histórico sem entradas extras, cancelamento e confirmação de logout, falha e sucesso ao salvar e navegação bloqueada durante salvamento. O roteiro é scripts/audits/settings-navigation-guard.cjs; nenhuma chamada de produção é usada. Escape na confirmação é consumido pelo próprio diálogo para não reabrir a confirmação por meio do modal subjacente; o foco retorna ao formulário. TypeScript, build e 41 testes de contratos/reducer/validação/navegação passaram. O Safari/iOS real não foi executado nesta etapa.

Regressão concluída: scripts/audits/form-discard.cjs passou em 320, 390 e 1366 px para Agendamentos, Calendário, Clientes, O.S. e Financeiro, além de edição de agendamento, estado pendente, falha e sucesso. Verifica cancelar, Escape, fechar, clique externo, manter/descartar, foco e beforeunload. A verificação de foco aguarda a restauração assíncrona do Radix, sem sleeps fixos. O modal subjacente não pode substituir o alvo de retorno enquanto a confirmação está aberta.
