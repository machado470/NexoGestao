# Administração de acessos de membros — 2026-11-08

## Entrega

Configurações permite alterar os papéis ADMIN, MANAGER, STAFF e VIEWER, além de ativar e desativar o acesso de membros já cadastrados. Os formulários usam modais canônicos, confirmação para mudança de ativação, estado de processamento, erro e atualização da lista após confirmação do backend. Contas ainda no fluxo de convite seguem nas ações específicas de convites.

A nova rota `PATCH /auth/organization/members/:id` exige administrador ativo, recebe apenas papel/estado e a versão `expectedUpdatedAt`, e extrai tenant e autoria da sessão. A versão evita sobrescrever uma alteração administrativa mais recente. Cada mudança gera auditoria na mesma transação; reenvio de um estado já aplicado não duplica alteração ou auditoria.

As alterações são serializadas pelo lock da organização. O ator é revalidado depois do lock; dois administradores tentando rebaixar um ao outro não podem deixar o tenant sem administrador. O próprio administrador não pode se desativar/rebaixar: deve pedir a outro administrador. A contagem defensiva preserva pelo menos um administrador ativo com pessoa operacional ativa.

A administração altera somente `User.role` e `User.active`. Não altera a função operacional em `Person.role`, histórico, atribuições ou estado operacional. Reativar acesso de uma pessoa operacional inativa é recusado: essa condição deve ser tratada em Pessoas. Alterações não transferem contas entre organizações.

## Autorização e sessão

O JWT continua identificando a sessão e sua expiração, mas a estratégia passa a consultar usuário/tenant/estado ativo/papel atuais no banco em cada requisição. Um token antigo não preserva privilégios de ADMIN após rebaixamento e um usuário desativado tem novas requisições rejeitadas. O acesso de usuário vinculado a pessoa inativa também é rejeitado. Isso adiciona uma consulta ao banco por autenticação; a indisponibilidade do banco não libera acesso.

O frontend deixa de oferecer Configurações a MANAGER, alinhando o menu e a guarda da rota à exigência ADMIN que a API já tinha.

No teste de navegador, a consulta `/me` atingiu o limite global de dez requisições/minuto porque o BFF a usa para revalidar a sessão em cada consulta da tela. Essa rota agora tem orçamento próprio de 120/minuto; os demais endpoints mantêm seus limites existentes. Um teste HTTP garante que a mudança não libera o limite global das outras rotas.

A validação do campo `active` preserva o tipo recebido, mesmo com conversão implícita habilitada no bootstrap; a string `"false"` não pode virar uma ativação booleana acidental.

## Escopo

Nenhuma integração externa foi implementada ou acionada nesta entrega. Os testes com banco usam PostgreSQL/Redis locais descartáveis. Não houve migration nem publicação. A revogação vale para novas requisições; esta alteração não encerra à força conexões SSE já abertas, e reativar uma conta permite novamente tokens ainda não expirados.

## Resultados da validação

- Suíte API padrão: 701 testes aprovados; os dois casos adicionais de orçamento HTTP de `/me` passaram depois, assim como a regressão específica de autenticação/administração (23 casos).
- Suíte web completa: 605 testes aprovados.
- PostgreSQL local e HTTP reais: 10 testes aprovados, incluindo autorização com token antigo, isolamento, concorrência entre administradores, auditoria, versão otimista e validação booleana com conversão implícita habilitada.
- Fluxo canônico completo da aplicação com PostgreSQL/Redis: 1 teste aprovado após a mudança de autenticação.
- Build dos três pacotes, checagem de tipos e lint operacional web: aprovados.
- Chromium/Playwright com API, BFF e banco reais locais: login pela tela, alteração de STAFF para VIEWER, desativação, reativação, proteção do próprio acesso e persistência após recarregar. Verificado em 1365×900 e 390×844, sem overflow horizontal nem exceções JavaScript. A consulta direta ao banco confirmou User.role=VIEWER, Person.role=TECH, estado operacional preservado e auditoria das três ações.

A primeira tentativa no navegador encontrou o limite de `/me` após duas operações; a rodada final passou com a correção descrita acima e o limitador habilitado. Não foi desabilitada a limitação global para realizar a prova.

Os processos de API/BFF, os containers descartáveis e sua rede foram encerrados após os testes. Nenhum dado de aplicação existente foi utilizado.
