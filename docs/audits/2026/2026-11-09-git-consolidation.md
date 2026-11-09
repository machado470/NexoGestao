# Consolidação das correções para revisão no Git

As correções administrativas e operacionais desta sessão foram consolidadas na branch `codex/correcoes-administrativas-operacionais`, baseada na main `eec48fc8733b3635f7ffcee8f295a9f03a22c807`.

A atualização da base preservou a validação e revogação de sessões por `sessionVersion` adicionadas em paralelo. Os testes de administração de membros foram alinhados à rejeição de tokens antigos com HTTP 401. A separação canônica de papéis permanece coberta por testes exaustivos. O compartilhamento de observabilidade reutiliza o `WhatsAppMetricsModule` da main, evitando módulo duplicado.

A instalação foi alinhada ao lockfile da main e o Prisma Client foi regenerado para o schema atualizado. Os scripts temporários e bancos de teste permanecem fora do commit.

## Verificação

- A verificação completa `pnpm ci:preflight` passou antes de atualizar a base.
- Após atualizar a base, os testes reais de ciclo de convites e administração de membros passaram: duas suítes e 15 casos, com PostgreSQL local temporário.
- O teste isolado de limites de requisição recebeu o mock da nova dependência de validação Google do AuthController, sem executar integração externa. Sua expectativa de login foi atualizada de dez para cinco tentativas, preservando a política de autenticação mais restritiva da main.
- A suíte completa do frontend após atualizar dependências e base passou: 95 arquivos e 767 testes.
