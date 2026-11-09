# Confirmação na criação de clientes

## Problema e correção

O cadastro ainda tratava a gravação e a invalidação posterior como uma única operação. Uma exceção após criar o cliente podia restaurar a lista anterior e oferecer uma nova tentativa de criação.

O formulário agora reutiliza a separação entre persistência e sincronização da edição. Após a resposta oficial, mantém a tela de sucesso com o cliente criado, limpa o formulário e inclui o registro confirmado no cache sem duplicar seu id. Uma falha posterior mostra aviso de atualização indisponível e não restaura a lista antiga nem oferece a criação como rejeitada.

Um bloqueio síncrono evita envios simultâneos antes de o React desabilitar o botão. Depois da confirmação, a mesma ação de envio também é bloqueada até o usuário escolher explicitamente criar outro. O formulário continua preservando dados quando a gravação não foi confirmada. A indicação de cadastro sincronizado foi substituída por confirmação de criação, pois as consultas podem ainda estar pendentes.

A proteção de idempotência existente no backend permanece aplicável. Não houve mudanças na API nem em integrações externas.

## Verificação

- Frontend completo: 89 arquivos, 722 testes passaram.
- O cadastro reutiliza o fluxo já coberto pelos quatro testes de confirmação, rejeição e falhas posteriores ao commit.
- Build, typecheck, lint e `git diff --check` passaram.
- Chromium com API, BFF e PostgreSQL locais: após o commit da criação, as consultas da lista receberam HTTP 503. A confirmação permaneceu visível, o aviso de atualização foi exibido e não apareceu tentativa de criação como rejeitada. Dois cliques síncronos enviaram uma requisição e o banco manteve um cliente. Restaurar a leitura e recarregar a página exibiu o cadastro confirmado.
- Script temporário em `work/customer-create-confirm-browser.cjs`. WhatsApp permaneceu mock; nenhuma integração externa foi exercitada. Serviços e banco temporários foram encerrados após a validação.
