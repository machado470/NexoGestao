# Preservação de edições em Configurações

## Problema e correção

A sincronização da consulta com o formulário substituía todos os campos quando um valor remoto mudava, apagando edições locais. O sucesso de uma gravação também dependia da invalidação e leitura posterior da consulta.

O formulário agora mantém valores editados e uma referência aos últimos valores recebidos. Novas consultas atualizam apenas campos que não foram editados. Descartar retorna aos valores mais recentes recebidos do servidor. Isso preserva o rascunho durante atualizações manuais e automáticas.

A resposta oficial da mutation atualiza o cache e confirma os valores do formulário, incluindo normalização de espaços. Uma consulta em andamento é cancelada antes do envio para impedir que sua resposta antiga substitua os dados confirmados. Não há leitura adicional obrigatória após salvar.

Uma falha de atualização com dados em cache mantém o formulário visível e exibe um aviso de que as edições foram preservadas. A falha de carregamento inicial continua exibindo o estado indisponível.

Esta etapa não adiciona controle de concorrência entre administradores: um salvamento continua submetendo os três campos conforme o contrato existente. Não há recuperação de rascunho após recarregar a página.

## Validação

- Suíte frontend: 86 arquivos, 671 testes passaram.
- Sete testes permanentes do estado do formulário cobrem preservação de todos os campos editados, adoção de campos intactos, consultas repetidas, descarte, confirmação sem leitura e alterações coincidentes.
- Recorte final após inclusão do cancelamento de consultas: 12 testes passaram; typecheck e build finais passaram. Lint e `git diff --check` passaram.
- Chromium com API, BFF, PostgreSQL e Redis locais: alteração remota de nome e fuso durante edição preservou o nome local e adotou o fuso remoto; descarte adotou o nome remoto. Um salvamento com espaços foi confirmado e normalizado no banco sem qualquer nova requisição `settings.get`. Uma atualização posterior recebeu HTTP 503, manteve o formulário e o rascunho, e a recuperação da leitura também preservou o texto. O descarte final retornou ao nome confirmado.
- O script de navegador temporário está em `work/`. Os serviços e o banco temporário foram encerrados após a validação. Nenhuma integração externa foi exercitada; WhatsApp permaneceu mock.
