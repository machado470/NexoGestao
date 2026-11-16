# Isolamento da métrica de usuários vinculados a Pessoas

## Falha e correção

`GET /people/stats/linked` exigia ADMIN, mas o serviço contava pessoas com usuário vinculado em toda a base. O administrador de uma organização recebia uma métrica agregada de outras organizações.

O controller agora repassa exclusivamente o `orgId` da sessão autenticada. A consulta combina esse filtro com `userId != null`. O serviço rejeita organização ausente antes de chamar o Prisma, evitando que um filtro `undefined` volte a produzir contagem global. Não houve mudança no significado de vínculo nem nas permissões da rota.

Nenhum frontend ou integração externa precisou ser alterado.

## Verificação

- API completa: 138 suítes e 780 testes passaram; 62 testes ignorados conforme configuração existente.
- Oito novos testes cobrem contagens por organização, organização ausente, parâmetro de URL sem autoridade sobre o tenant e bloqueio de MANAGER, STAFF e VIEWER na métrica administrativa.
- Build, typecheck e `git diff --check` passaram.
- API real com PostgreSQL e Redis locais, autenticação por login e JWT: organização A com dois vínculos recebeu 2; organização B com três vínculos recebeu 3. Pessoas sem usuário foram excluídas. Enviar o id da organização B na query da sessão A manteve 2. Requisição anônima recebeu 401 e usuário STAFF recebeu 403.
- Script temporário em `work/linked-count-real.cjs`. A primeira execução aguardou a disponibilidade da API após uma falha de conexão no início da inicialização; a repetição completou as verificações. WhatsApp permaneceu mock, sem envio externo. Serviços e banco temporários foram encerrados após a validação.
