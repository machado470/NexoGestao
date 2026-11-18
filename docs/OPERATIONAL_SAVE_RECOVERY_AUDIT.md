# Recuperação de salvamento: Agenda e O.S. — 18/11/2026

Agenda e criação de O.S. não tinham bloqueio síncrono entre dois eventos de envio antes do próximo render. Cada formulário agora mantém um bloqueio em memória durante a mutation. Uma recusa libera o formulário com os dados preservados; enquanto o envio está pendente, cancelar/fechar permanece bloqueado.

Uma confirmação do serviço agora atualiza a interface antes de aguardar consultas secundárias. Na Agenda, o formulário fecha e mostra a mensagem de salvamento; na O.S., aparece a confirmação com acesso ao registro salvo. As consultas continuam sendo atualizadas em segundo plano. A criação confirmada da O.S. não deixa o botão Criar disponível, e outra chamada de submit é ignorada enquanto existe o registro confirmado.

O aviso persistente de erro da O.S. guardava uma callback submit com o formulário daquele momento. Esse botão foi removido: o aviso orienta revisar os dados preservados no formulário, sem poder reenviar um payload antigo depois de editar ou fechar a tela. Respostas interrompidas pedem conferir a lista antes de repetir.

Limite: isto bloqueia envios simultâneos na interface e separa confirmação de leitura; não adiciona idempotência a Agenda/O.S., não resolve resposta perdida entre sessões e não faz retry automático de mutations. O contrato de API foi mantido.

Validação local: 37 testes de datas, atualização confirmada e contratos operacionais, TypeScript e build Vite. scripts/audits/operational-save-recovery.cjs verificou em 320/390 px: duplo envio imediato, POST pendente com cancelar/Escape, recusa BAD_REQUEST com rascunho preservado, nova tentativa manual, confirmação antes de liberar leituras deliberadamente lentas e ausência de callback de gravação no aviso antigo. scripts/audits/mobile-customer-to-payment.cjs passou novamente até pagamento, incluindo busca/edição do cliente e escolha de continuidade.

As APIs dos roteiros são interceptadas com objetos locais; não houve criação de agendamento/O.S., cobrança ou pagamento real. Safari/iPhone real e API de produção não foram executados.
