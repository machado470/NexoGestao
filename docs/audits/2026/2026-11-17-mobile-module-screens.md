# Telas internas no padrão mobile

## Mudança

Clientes, Agenda, Serviços (O.S.) e Financeiro agora compartilham um cabeçalho compacto no celular: título curto, descrição breve, quantidade do recorte e ação de cadastro quando permitida. O cabeçalho desktop permanece na composição anterior. A atualização do Financeiro continua acessível pelo cabeçalho mobile.

As listas usam superfícies consistentes, com menos bordas e molduras aninhadas. Filtros e indicadores mantêm seus campos e valores, com estrutura mais leve. Os campos financeiros ocupam a largura disponível no celular. Nos cartões de cobrança, o saldo passa a ter maior destaque; valor original, moeda persistida, pagamentos e ações continuam disponíveis.

Em Clientes, a informação de risco e a ação de abrir o registro permanecem visíveis. Dados auxiliares de atendimento e histórico ficam em expansão por item. Nome, contato, prioridades e filtros mantêm as fontes existentes. A moldura externa do detalhe de Clientes, Agenda e O.S. foi simplificada no mobile; lista → detalhe → voltar continua preservando contexto.

Em O.S., nomes e descrições podem quebrar linha no celular. As decisões, prioridades, prazos, capacidades e ações não foram recalculados ou alterados. O cartão selecionável continua acessível por teclado, com foco visível.

Sem alterações em API, banco, permissões, ordenação de registros ou contratos financeiros. O frontend não cria severidades nem troca a moeda dos registros. Os textos das mensagens de ausência e os testes financeiros refletem a apresentação atual de moeda persistida, zero legítimo e valor não informado.

## Verificação

- 64 testes web: centro operacional de Clientes, contrato e ações de O.S., agenda, carteira financeira, pagamento manual, atualização de cliente e rascunho de edição.
- Typecheck web e build Vite de produção.
- Chromium com fixtures locais em 320/375/390/430 px: cabeçalhos, cartões visíveis, nomes extensos, ausência de transbordamento horizontal, expansão por cliente e detalhe/retorno. VIEWER sem ação de cadastro; tabelas financeiras desktop preservadas.
- Regressão do protocolo anterior de lista/detalhe/retorno em Agendamentos, O.S. e Equipe; abertura dos diálogos financeiros de pagamento e cancelamento; vínculo inexistente e retorno à lista. Sem escritas em produção.
- Script reproduzível: `scripts/audits/mobile-module-screens.cjs`. Iniciar Vite em localhost:5173; executar com Playwright disponível (NODE_PATH pode apontar para a instalação) e Chromium em `/usr/bin/chromium`.

## Limites

As capturas e os testes de navegador usam dados simulados, não dados reais da empresa. Validar no Safari/iPhone físico, com teclado virtual, listas grandes e conta autenticada após o deploy. Esta etapa não redesenha Timeline, Auditoria, Governança ou as telas públicas; esses módulos continuam como próximos trabalhos da revisão.

Não altera o fluxo de descarte dos formulários nem transforma o produto em aplicativo nativo. Merge manual; a publicação web acompanha a branch configurada no Railway após merge.
