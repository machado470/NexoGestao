# Finalização do onboarding com evidência persistida

## Falha e correção

O endpoint de finalização alterava `requiresOnboarding` para falso sem validar registros. Informar `createCharge` em `complete-step` também liberava a organização. A consulta de status podia escrever na organização ao encontrar contagens positivas, e contava ordens abertas e cobranças sem vínculo ou canceladas.

Agora o GET de status é somente leitura. A finalização explícita verifica cliente cadastrado, O.S. em DONE e cobrança PENDING, OVERDUE ou PAID vinculada a O.S. concluída, com relações filtradas pela organização. Solicitações incompletas recebem HTTP 400 sem alterar a organização. O endpoint alternativo usa a mesma verificação. ADMIN e MANAGER podem finalizar; STAFF e VIEWER podem consultar, mas não executar esses POSTs.

Organizações já liberadas continuam liberadas e a finalização é idempotente. A regra não reabre cadastros antigos se seus dados operacionais forem alterados depois.

A tela usa o status oficial para as etapas de serviço, cobrança e habilitação do botão final. Progresso de apresentação no navegador não substitui evidência persistida. Se a leitura falhar, o usuário pode consultar o progresso novamente. As consultas são atualizadas após as etapas e a geração de dados de demonstração.

Nenhuma integração externa foi alterada ou exercitada.

## Verificação

- Recorte da API: 16 testes passaram, incluindo sete testes HTTP de permissões, evidência incompleta, tenant autenticado e GET sem escrita.
- Nove testes do serviço verificam os filtros de evidência, falta de cada etapa, endpoint alternativo, etapa intermediária, finalização válida e idempotência.
- Suíte completa da API: 772 testes passaram, 62 ignorados conforme configuração existente. Frontend completo: 730 testes passaram; recorte posterior de sessão, contrato da tela e ciclo da O.S.: 20 passaram.
- Build e typecheck da API e do frontend passaram; lint do frontend e `git diff --check` passaram.
- Chromium com API, BFF e PostgreSQL locais: completar uma organização vazia pelos dois endpoints recebeu HTTP 400 sem liberá-la. A jornada criou cliente, agendamento e O.S., retomando a mesma ordem após falha simulada no início da execução, e gerou cobrança vinculada de 15.025 centavos. Consultar status com todos os registros prontos manteve `requiresOnboarding: true`. Cancelar a cobrança ou remover seu vínculo com a O.S. voltou a impedir a finalização. Restaurar o vínculo válido permitiu finalizar explicitamente e abrir o dashboard.
- A validação também confirmou a necessidade de invalidar o status oficial após criar o cliente, corrigida na tela antes da repetição bem-sucedida da jornada.
- Script temporário em `work/onboarding-evidence-browser.cjs`; alterações diretas no banco foram usadas apenas para preparar casos negativos de cobrança. WhatsApp permaneceu mock. Serviços e banco temporários foram encerrados após a validação.
