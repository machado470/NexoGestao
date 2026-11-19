# Filtros de evidências: toque, tipografia e tema

Timeline e Auditoria ainda tinham campos com altura de 40 px e alguns seletores com texto menor que 16 px no celular. Os seletores nativos da Auditoria usavam um fundo diferente dos demais campos; o indicador nativo de data também podia ficar escuro sobre fundo escuro.

Em até 767 px, os campos e botões dos filtros têm altura mínima de 44 px, campos/seletores usam 16 px e respeitam a largura disponível. As regras ficam restritas aos filtros das páginas de evidências. Os dois seletores nativos da Auditoria usam tokens de borda, fundo e texto dos campos. `color-scheme` acompanha o tema desses filtros, incluindo controles nativos de data/seleção. No desktop, a regra de aumento móvel não é aplicada.

Nenhuma alteração de opções, valores enviados, fuso, pesquisa ou permissões.

## Verificação local

- TypeScript e build Vite.
- `evidence-filter-touch.cjs`, Chromium com fixtures em 320 px/escuro, 390 px/claro e 1280 px/claro: campos dentro da tela; altura >=44 px e fonte de 16 px no celular; esquema nativo acompanhando tema; contraste dos dois seletores da Auditoria >=4,5:1.
- Timeline: selecionar tipo de evento filtra registros e Limpar filtros restaura o recorte.
- Auditoria: selecionar ator/evento e data envia os valores corretos e o início do dia em America/Sao_Paulo (`03:00Z` no caso testado); Limpar restaura campos vazios. Sem POSTs, erros de página ou overflow horizontal.

## Limites

Testes locais com respostas simuladas. Não testado em Safari/iPhone real, nos seletores/pickers nativos do sistema operacional ou na API de produção. Tipografia e geometria foram medidas no Chromium; a experiência com teclado/picker real depende do aparelho.
