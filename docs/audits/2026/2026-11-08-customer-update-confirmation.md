# Confirmação da edição de clientes

## Problema e correção

O editor colocava a gravação, a invalidação de consultas e o callback da tela no mesmo bloco de erro. Uma exceção após o commit podia restaurar a lista anterior e apresentar a alteração persistida como falha.

O fluxo agora separa persistência e sincronização posterior. Só a rejeição da gravação mantém o editor como tentativa pendente, com tratamento de conflito e preservação do rascunho. Uma gravação confirmada atualiza o cache com a resposta oficial, fecha o editor e informa sucesso antes de atualizar consultas. Falhas posteriores geram aviso de atualização indisponível, sem restaurar valores antigos nem oferecer a gravação como falha.

A lista deixou de receber atualização otimista antes do envio. Um bloqueio síncrono impede duas requisições produzidas por cliques no mesmo ciclo de renderização. A atualização posterior da lista usa uma consulta que propaga falhas, pois invalidação de cache normalmente suprime erros de leitura.

Nenhuma alteração de API, banco ou integração externa foi necessária nesta etapa.

## Verificação

- Frontend completo: 89 arquivos, 722 testes passaram.
- Quatro novos testes verificam gravação rejeitada sem confirmação, resposta normalizada confirmada antes de terminar a leitura, falha de leitura após commit e falha de callback posterior ao commit.
- Build, typecheck, lint e `git diff --check` passaram.
- Chromium com API, BFF e PostgreSQL reais locais: uma alteração confirmada pela API foi seguida de HTTP 503 nas leituras da lista. O editor fechou, exibiu confirmação e aviso separado, e o banco manteve a alteração. Dois cliques síncronos produziram uma única requisição. Após restaurar as leituras, reabrir mostrou o nome salvo. Uma tentativa posterior com versão desatualizada recebeu conflito, manteve o rascunho aberto e preservou a alteração concorrente no banco.
- Script temporário em `work/customer-commit-browser.cjs`. WhatsApp permaneceu mock; nenhum envio externo foi exercitado. Serviços e banco temporários foram encerrados após a validação.
