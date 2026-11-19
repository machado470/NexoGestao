# Notificações: leitura, recuperação e legibilidade

## Problema e comportamento

Marcar um aviso como lido não mostrava erro em caso de falha. Toques repetidos podiam enviar a mesma ação em paralelo; a mensagem era cortada após duas linhas, e o título ficava claro demais no tema claro por usar token de cor fora do contexto do portal.

A leitura agora possui trava síncrona e estado por id. O menu mostra envio pendente ou erro junto ao aviso afetado, com ação explícita de nova tentativa. Outros avisos continuam independentes. Confirmar a mutation termina o estado pendente antes das invalidações de consulta; contagens/estado lido continuam vindo do backend, sem atualização financeira ou contagem otimista.

Rotas seguras continuam navegando imediatamente e fechando o menu, mesmo que a leitura falhe depois. Nesse caso, reabrir mostra o erro naquele aviso. Nova tentativa usa item de menu acessível por seta/Enter, com altura mínima de 44 px.

O cabeçalho quebra em duas linhas, títulos usam cor do portal, a ação tem contraste e sublinhado e as mensagens completas ficam dentro da rolagem limitada do menu. Permissões e validação das rotas foram preservadas.

## Validação local

- 21 testes de rotas de aviso, navegação móvel/permissões e busca; TypeScript e build Vite.
- `mobile-notification-feedback.cjs`, Chromium com fixtures em 320/390 px, tema claro/escuro: mensagem completa; título com contraste >= 4,5:1; menu sem overflow horizontal; clique duplo com um envio; A pendente/B independente; erro apenas em A; nova tentativa por seta/Enter; confirmação antes de GET retido; navegação segura mesmo com falha de leitura e erro visível ao reabrir.
- `mobile-search-navigation.cjs`: seleção por aviso continua fechando o menu, inclusive na rota atual.
- `mobile-app-home.cjs`: regressão de menu, cabeçalho, abas, busca, atalhos de criação, papéis, tema claro e desktop.

## Limites

Respostas interceptadas, sem gravações reais. Não testado em Safari/iPhone real nem API de produção. A trava e os erros pertencem à sessão montada do layout; recarregar pode apagá-los. O estado definitivo de leitura e o total não lido continuam dependentes da consulta do serviço.
