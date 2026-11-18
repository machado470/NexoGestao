# Jornada mobile: cliente até recebimento — 18/11/2026

A jornada local reproduziu três problemas de continuidade:

- O cadastro confirmava o cliente, mas o próximo passo escolhido ficava disponível apenas em notificações. A confirmação agora tem um botão permanente para abrir agendamento/cobrança com cliente selecionado. O atalho consome action=create já suportado pelo destino; abrir o formulário não salva outra entidade.
- O reset do formulário trocava a escolha de próximo passo para agenda. A confirmação agora guarda a escolha junto ao cliente salvo. Criar cobrança continua criando cobrança; Apenas cadastrar permanece opcional. WhatsApp abre somente o contexto, sem enviar mensagem.
- Avisos persistentes se acumulavam sobre o botão Voltar no celular. Eles agora ficam dentro do sino, em Avisos desta sessão, com ações preservadas, rolagem, dispensa acessível e alvos de toque de 44 px. O aviso escolhido fecha o painel. Desktop mantém a apresentação flutuante existente.

O botão de uma O.S. nova também passa de Salvar alteração para Criar O.S. O atalho Criar O.S. do cliente abre o formulário com o cliente informado.

O roteiro scripts/audits/mobile-customer-to-payment.cjs usa respostas locais com estado para percorrer cadastro, agendamento com responsável, O.S. vinculada ao agendamento, início, conclusão, geração de cobrança e pagamento manual. Confere cliente, responsável, vínculo com agendamento, conversão de R$ 150,00 para 15000 centavos, 09h da empresa para 12h UTC, saldo final zero e um único envio do pagamento. Depois confere busca sem resultado/com resultado, edição, detalhe, retorno à lista, ações dos avisos no sino, escolha de cobrança preservada e Apenas cadastrar sem novo agendamento.

Validação: Chromium em 320 e 390 px, com interface de toque simulada, sem overflow horizontal ao final. 94 testes de continuidade, rascunho, atualização, datas, pagamento e contratos operacionais passaram, assim como TypeScript e build Vite. Os writes do roteiro são interceptados e alteram somente objetos locais. Não houve cadastro, cobrança, mensagem ou pagamento real. Isto valida a interface diante dessas respostas simuladas; não substitui uma integração com a API real nem uma rodada em Safari/iPhone com teclado nativo.
