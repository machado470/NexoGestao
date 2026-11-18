# Menu Mais e carregamento — 17/11/2026

O menu Mais e a busca usavam --surface-primary, sem definição no tema. Como o diálogo é renderizado em um portal no body, as cores locais de .app-root também não garantiam a camada de escurecimento. Uma declaração background com var inválida resolve para transparente, expondo o conteúdo atrás do menu.

Os dois diálogos agora usam a superfície de overlay existente, com fallback sólido. O scrim tem valores globais para os dois temas e fallback no componente DialogOverlay. O menu mantém altura limitada, rolagem interna, overscroll contido, espaço seguro inferior e botão de fechar com alvo de 44 px. Não foram alteradas rotas, permissões ou ações disponíveis.

Clientes, Agendamentos, O.S. e Financeiro passam a repetir uma leitura uma única vez, após 500 ms, para falhas de transporte e HTTP 408/429/500/502/503/504. Erros de autorização, validação e recursos inexistentes não são repetidos. Mutations permanecem com retry zero. Não há loop de recuperação ou sucesso presumido: se a segunda tentativa falhar, a tela continua exibindo o erro e a ação de tentar novamente.

Quando uma leitura principal é refeita sem dados disponíveis, a tela mostra carregamento durante a consulta, em vez de manter o erro antigo enquanto a nova resposta chega. Dados já carregados não são apagados por uma atualização de fundo. Não foi possível identificar pelo relato quais eram todas as telas/mensagens observadas em produção; a recuperação foi validada nestes quatro módulos com falhas simuladas.

Validação local: 66 testes de política de retry, contratos operacionais e navegação financeira; TypeScript e build Vite. O roteiro scripts/audits/mobile-menu-loading.cjs verifica a superfície sólida e o scrim de Mais/Buscar nos temas claro e escuro, menu em 320/390/430 px, ausência de overflow horizontal e acesso às últimas opções por rolagem. Também simula falha transitória seguida de sucesso nas quatro telas, falha persistente, carregamento durante nova tentativa em Agenda/Financeiro e HTTP 403 sem retry. Todas as chamadas usam fixtures locais, sem writes ou acesso à produção. O Safari/iOS real não foi executado.
