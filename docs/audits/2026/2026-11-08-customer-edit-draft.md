# Rascunho e versão na edição de clientes

## Problema e correção

O editor reinicializava todos os campos quando a consulta de detalhe mudava, apagando edições locais. O envio também usava o `updatedAt` mais recente da consulta, em vez da versão dos dados revisados pelo usuário.

O formulário agora mantém uma sessão de edição com os valores iniciais e a versão correspondente. Atualizações em segundo plano do mesmo cliente preservam os campos e o token de concorrência. Trocar de cliente ou fechar e reabrir o editor inicia outra sessão.

A ação `Recarregar dados` consulta os valores atuais e só substitui o rascunho após confirmar o descarte das alterações. Cancelamento e falha de leitura preservam o rascunho. A ação de recarga oferecida no aviso de conflito usa o mesmo fluxo. Quando há dados em cache, erros de leitura mantêm o formulário visível com aviso.

Não há persistência do rascunho após recarregar a página. A API existente continua responsável pelo bloqueio de gravações com versão antiga; nenhuma mudança de backend ou integração foi necessária nesta etapa.

## Validação

- Frontend completo: 88 arquivos e 718 testes passaram.
- Sete testes permanentes do estado do formulário cobrem a versão inicial, preservação após consultas, recarga explícita, troca de cliente, fechamento e reabertura e comparação de valores aparados.
- Build, typecheck, lint e `git diff --check` passaram.
- Chromium com API, BFF e PostgreSQL locais: alteração remota seguida de reconexão após o prazo de stale da aplicação atualizou a consulta em segundo plano sem apagar o nome em edição. O envio manteve a versão original e recebeu conflito, preservando o valor remoto no banco. Cancelar a confirmação de recarga manteve o texto; uma recarga com HTTP 503 também preservou o formulário. A recarga explícita bem-sucedida adotou o nome e a versão atuais, permitindo salvar uma nova edição revisada.
- Script temporário em `work/customer-draft-browser.cjs`. WhatsApp permaneceu mock, sem chamadas a integrações externas. Serviços e banco temporários foram encerrados após a validação.
