# Busca em telas baixas e área visível reduzida

## Problema

A busca móvel usava posição fixa a 15% da altura e permitia o conteúdo sair da janela. Com 20 resultados simulados e 420 px de altura, a janela começava em 63 px e terminava em 422 px: ultrapassava a área visível. Em telas menores, os resultados podiam ficar ainda mais distantes do campo/botão de fechar.

## Alteração

A janela acompanha altura e deslocamento de `window.visualViewport`, ouvindo resize/scroll enquanto aberta e removendo listeners ao fechar. Usa `innerHeight`/resize como fallback. Margens e áreas seguras delimitam a janela; o campo e o cabeçalho não encolhem e os resultados rolam dentro do espaço restante. O modo desktop conserva seu posicionamento.

Não há alteração de contratos de busca, autorização, rotas, debounce, tratamento de erro ou resultados oficiais.

## Verificação local

- 21 testes de normalização da busca, navegação/permissões móveis e rotas de avisos.
- TypeScript e build Vite.
- `scripts/audits/mobile-search-viewport.cjs`, Chromium em 320/390 px, alturas 844/420/280, com 20 clientes simulados: janela dentro da tela, campo/fechar visíveis, último resultado alcançável, ausência de overflow horizontal e seleção fechando a busca na rota correta. Tema escuro e claro.
- VisualViewport simulado com altura de 280 e deslocamentos de 90/120 sem alterar a altura do layout: resize e scroll reposicionam/dimensionam a janela.
- Regressão `mobile-search-navigation.cjs`: contrato agrupado/legado, resultado antigo oculto durante nova busca, limpar, erro/retry/vazio, permissões e navegação por aviso.
- Regressão `mobile-app-home.cjs`: cabeçalho, abas, menu, busca e atalhos de criação em múltiplas larguras/papéis, tema claro e desktop.

## Limites

Dados interceptados, sem writes reais. Não foi testado teclado nativo nem Safari/iPhone real. Reduzir o viewport e simular VisualViewport valida a lógica de layout/eventos, sem reproduzir todas as diferenças de navegadores/dispositivos. A confirmação final em aparelho continua necessária.
