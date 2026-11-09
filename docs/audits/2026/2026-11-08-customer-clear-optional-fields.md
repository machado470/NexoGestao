# Limpeza de campos opcionais de clientes

## Falha e correção

O editor transformava e-mail e observações vazios em `undefined`, omitindo os campos da requisição. O servidor preservava os valores antigos, embora a atualização otimista exibisse campos vazios.

O editor agora envia `null` para limpar esses campos. O contrato de atualização do BFF e os tipos da API aceitam esse valor explicitamente. O serviço aplica `null` no banco e registra o patch na auditoria. Campos omitidos permanecem intactos, e validações de e-mail preenchido continuam aplicáveis. O contrato de criação não mudou.

A alteração mantém o isolamento por organização e o controle de versão `expectedUpdatedAt` existente. Não envolve migração de banco ou integrações externas.

## Verificação

- API completa: 756 testes passaram, 62 ignorados conforme configuração existente.
- Seis novos testes da API cobrem limpeza individual e conjunta, atualização parcial sem limpeza, auditoria, aceitação de nulos no DTO e rejeição de e-mail inválido.
- Três novos testes do BFF verificam encaminhamento de nulos, preservação de campos omitidos e rejeição de e-mail inválido antes da chamada à API.
- Frontend completo: 87 arquivos, 711 testes passaram.
- Build e typecheck da API e do frontend passaram. Lint do frontend e `git diff --check` passaram.
- Chromium com API, BFF e PostgreSQL locais: cliente com e-mail e observações preenchidos foi editado pela tela, ambos foram apagados e confirmados como `null` no banco; após recarregar a página e reabrir o editor, os campos permaneceram vazios. Novo preenchimento persistiu os dois valores, mantendo o telefone original.
- Script temporário em `work/customer-clear-browser.cjs`. Nenhuma integração externa foi exercitada; WhatsApp permaneceu mock. Os serviços e o banco temporário foram encerrados após a validação.
