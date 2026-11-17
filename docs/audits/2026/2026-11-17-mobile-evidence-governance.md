# Timeline, Auditoria e Governança no mobile

## Comportamento

As três páginas usam o cabeçalho mobile compartilhado e a composição de cores das telas anteriores. A estrutura desktop permanece disponível.

- Auditoria: cartões legíveis no celular, com data, evento, responsável, contexto e abertura do modal de evidência. A tabela continua no desktop. Paginação, filtros e consulta de resumo permanecem no servidor. Os filtros completos ficam sob expansão no celular.
- Timeline: pesquisa visível, filtros avançados recolhidos e registros com superfícies consistentes. Ator, entidade e origem ficam disponíveis por expansão. Metadados e link oficial permanecem acessíveis. Os tipos conhecidos usam os rótulos de apresentação existentes; tipos desconhecidos continuam explícitos, sem classificação inventada.
- Governança: situação atual e próxima ação em destaque; contexto da avaliação, fatores da nota e histórico disponíveis sob expansão. O celular mostra os três primeiros sinais na ordem recebida e oferece Ver todos/Mostrar menos. O desktop mantém todos os sinais visíveis. O estado operacional e a nota automática permanecem fontes distintas.

A cor do estado principal usa diretamente o enum oficial; a categoria da ação usa o nome da área, sem convertê-la em um estado de execução. Nenhuma prioridade, severidade, pontuação ou transição é calculada na página. Abrir o destino da recomendação continua sendo navegação/consulta, sem execução automática.

## Horários e período da Auditoria

As três páginas exibem os instantes no fuso da organização, preservando segundos. O filtro de Auditoria transforma os dias civis em limites UTC nesse fuso, incluindo dias com duração diferente de 24 horas. Período inválido/invertido é recusado antes da consulta. Sem confirmação do fuso, filtrar por data apresenta orientação e não aplica limites presumidos. Filtros sem datas continuam disponíveis.

A validação não altera os códigos enviados de ator/evento, a organização autenticada, as permissões administrativas ou a ocultação de dados sensíveis. Metadados continuam passando pelos helpers e contratos anteriores; não há JSON bruto novo na interface.

## Validação

- 33 testes web: normalização e acesso da Auditoria, metadados seguros, contrato e evidência da Timeline, autoridade operacional da Governança e formatos/fusos/moedas compartilhados.
- Typecheck web e build Vite.
- Chromium local com fixtures em 320/375/390/430 px: cartões de Auditoria, modal e paginação; pesquisa e expansões da Timeline; contexto, fatores, sinais e histórico de Governança. Sem transbordamento horizontal nas verificações.
- Navegador em UTC e empresa em America/Sao_Paulo: 12:00:17Z exibido como 09:00:17; filtro de 17/11/2026 enviado entre 03:00Z e 02:59:59.999Z do dia seguinte.
- Período invertido recusado; valores preservados após falha da listagem; retry independente; falha de preferências impede filtro por data. Falha do estado não aparece como operação normal.
- VIEWER: Auditoria bloqueada antes da consulta e destino financeiro de Governança indisponível. Tabela desktop mantida. Campos sensíveis de teste não aparecem no modal. Sem escrita em produção.

Reprodução: Vite em localhost:5173, Playwright disponível e Chromium em `/usr/bin/chromium`; executar `node scripts/audits/mobile-evidence-governance.cjs` (ou configurar NODE_PATH para a instalação do Playwright).

## Limites

Capturas e verificações de navegador usam fixtures, não dados reais da empresa. Safari/iPhone físico, teclado virtual e percurso autenticado após deploy continuam para homologação. Os limites de consulta das fontes anteriores permanecem; esta etapa não implementa nova paginação na Timeline ou no histórico de governança.

Sem alteração de API, banco ou configuração Railway. Merge manual; o web publica a branch configurada depois do merge.
