# Busca global e navegação de avisos — 18/11/2026

O BFF globalSearch.search retorna { ok, data: { query, customers, serviceOrders } }, com coleções vindas da API. A tela tratava apenas listas simples, podendo exibir ausência de resultados apesar de uma resposta válida. O adaptador agora aceita o contrato agrupado e envelopes paginados, mantendo compatibilidade com a lista tipada anterior. Respostas estruturalmente inválidas aparecem como falha de consulta, distintas de uma lista vazia válida.

Destinos são construídos a partir do tipo e identificador codificado, em vez de confiar em route recebido. O filtro usa canVisitMobileRoute e o RBAC existente. Isso limita os atalhos apresentados; não substitui autorização do backend. O BFF atual consulta clientes e O.S., sem novos endpoints financeiros.

Durante os 250 ms de debounce e uma nova consulta, resultados anteriores não ficam clicáveis. Limpar/focar novamente não restaura hits antigos. Erro de consulta tem mensagem própria e Tentar novamente, preservando o termo; nenhum resultado só aparece após resposta válida vazia. Não foi adicionado retry automático de gravações.

No celular, campo com fonte de 16 px, ação Limpar de 44 px, limites mínimos de largura e resultados em fluxo dentro do diálogo evitam que nomes longos empurrem controles para fora da tela. Campo, ícones e lista usam cores sólidas dos tokens globais, incluindo tema claro nos portais. Selecionar um link válido de notificação fecha seu painel mesmo quando o destino já é a página atual.

Validação local: 21 testes de contrato, navegação por perfil e validação de links; TypeScript e build Vite. scripts/audits/mobile-search-navigation.cjs passou em 320/390 px e nos temas claro/escuro: resposta agrupada e lista anterior, debounce com resposta retida, limpar, falha/retry, resposta inválida versus vazia, resultado financeiro oculto para Equipe, rota externa ignorada e fechamento de notificação. O roteiro verifica contraste do texto no campo >=4,5:1 e botão Limpar dentro do viewport. scripts/audits/mobile-app-home.cjs passou novamente, incluindo desktop, perfis e tema claro.

Os roteiros usam sessões/respostas locais; somente a simulação de marcar aviso como lido foi gravada em fixtures. Nenhuma API de produção foi consultada ou alterada. Safari/iPhone real e teclado nativo não foram executados nesta rodada.
