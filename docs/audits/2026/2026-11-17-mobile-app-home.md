# Navegação mobile e Home operacional

## Mudança

A versão mobile agora tem cabeçalho em uma linha e barra inferior: Início, Agenda, Clientes, Financeiro e Mais. Perfis sem `finance:read` recebem O.S. no lugar de Financeiro. Os destinos do menu Mais reutilizam a filtragem de permissões do layout. O menu e a busca usam os diálogos existentes, com foco controlado e fechamento por Escape. O desktop mantém a barra lateral e a busca completa.

A Home mobile apresenta saudação, resumo curto, atalhos de cadastro permitidos, próxima ação oficial, até três sinais de atenção e próximo atendimento. O próximo atendimento considera os primeiros registros futuros SCHEDULED/CONFIRMED, ordenados pelo servidor; a janela de consulta avança a cada minuto. As datas usam o fuso da empresa. Ausência, carregamento, erro e resposta inválida são tratados separadamente.

A prioridade operacional continua vindo das fontes oficiais existentes. O frontend não inventa risco, recomendação, receita ou métricas. O resumo financeiro só aparece para perfis com acesso; zero válido é preservado e campo ausente permanece não informado. As demais áreas, indicadores, evidências e aprovações continuam acessíveis na seção expansível de detalhes. No desktop, o painel completo permanece aberto.

Os atalhos Cliente, Agendar, Nova O.S. e Cobrar encaminham para `action=create` nos respectivos módulos e abrem o formulário existente, mantendo sua proteção de descarte. A intenção é consumida com replace, preservando os demais parâmetros; voltar ao módulo não reabre o cadastro. A permissão de criação é conferida antes de abrir. Não há gravação automática.

O tema existente foi mantido, usando suas superfícies e o laranja de ação, com menos cartões aninhados. A barra reserva espaço inferior e respeita a safe area. Notificações temporárias aparecem acima dela para não cobrir a navegação. Os destinos e a origem dos dados não foram alterados.

## Validação

- 65 testes web: permissões de destinos, apresentação da Home, escolha e falha da agenda, dashboard, fluxo de O.S., agendamentos e navegação financeira.
- Typecheck web e build Vite de produção.
- Chromium local com fixtures, em 320/375/390/430 px: cabeçalho compacto, cinco destinos inferiores, Mais, busca, quatro atalhos abrindo os formulários reais e consumo de `action=create`. Sem transbordamento horizontal nas verificações.
- ADMIN/MANAGER/STAFF/VIEWER: Financeiro/Cobrar restritos, substituição por O.S. e ausência de atalhos de criação para VIEWER; intenção de criação recusada preserva os filtros da rota.
- Busca fecha ao selecionar o registro, inclusive na rota atual. Tema claro/escuro, campos ausentes, estado vazio e painel desktop conferidos.
- Regressão de lista → detalhe → voltar em Agendamentos/O.S./Equipe e de cartões/modais financeiros nas quatro larguras, mais tabelas desktop e vínculo inexistente.
- Scripts reproduzíveis: `scripts/audits/mobile-app-home.cjs` e o protocolo de regressão do relatório mobile anterior. Fixtures locais, sem escrita em produção.

## Repetição e limites

Iniciar Vite em localhost:5173. Com Playwright disponível e Chromium em `/usr/bin/chromium`, executar `node scripts/audits/mobile-app-home.cjs` (ou configurar NODE_PATH para a instalação do Playwright).

Sem migration ou configuração nova no Railway. É a primeira etapa visual; não transforma o produto em aplicativo nativo, não adiciona biometria ou funcionamento offline. Validar Safari/iPhone físico, teclado virtual, safe area do aparelho e percurso autenticado após deploy. Integrações e permissões de backend continuam sob os contratos anteriores.

Referências públicas de organização visual: [Nubank](https://nu.com/pt/sala-de-imprensa/companhia/aplicativo-do-nubank-organiza-rotina-em-transacoes-planejamento-e-shopping), [Itaú](https://www.itau.com.br/relacoes-com-investidores/noticias/itau-unibanco-lanca-novo-conceito-de-aplicativo-para-100-dos-correntistas/?lang=en) e [Wise](https://wise.com/br/). A proposta mantém a identidade do NexoGestão.
