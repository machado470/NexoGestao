# Abertura de retorno em garantia/retrabalho

## Fluxo entregue

Uma O.S. concluída pode originar uma nova O.S. aberta para o mesmo cliente, classificada como análise de garantia ou retrabalho, com título e motivo. Um problema registrado no aceite pode ser selecionado como origem do relato; o vínculo é opcional, pois nem todo retorno chega por esse canal. A classificação não aprova cobertura, prazo de garantia, gratuidade, comissão ou condição comercial.

O detalhe da O.S. original lista os retornos com paginação de dez itens. A nova O.S. mostra sua origem e permite voltar à original. Cada ordem mantém seus próprios status, execução, fotos, checklist e histórico; o registro de retorno preserva motivo, autor/data, título inicial e vínculo de origem.

A nova ordem não herda valor, vencimento, pagamento, cobrança, agendamento ou responsável. A equipe deve atribuir, agendar e conduzir a execução pelo fluxo normal da nova O.S. A original não é reaberta nem tem seus pagamentos alterados. Abrir retorno não altera ou revoga um aceite; a equipe deve revogar um link pendente separadamente quando apropriado.

## Regras técnicas e permissões

- ADMIN/MANAGER/STAFF criam; VIEWER consulta, seguindo as permissões existentes por empresa. Restrição de terceiros aos próprios serviços continua futura.
- Nova O.S. passa por `QuotasService.validateQuota(orgId, CREATE_SERVICE_ORDER)` e conta no limite de ordens do plano. A verificação usa a política existente. Como no fluxo comum, admissão não é uma reserva atômica global entre criações simultâneas de origens diferentes.
- Admissão ocorre antes de abrir a transação, para não manter conexões ocupadas aguardando outra consulta do mesmo pool. Uma tentativa já confirmada é recuperável sem nova admissão, mesmo quando o plano passou a negar novas ordens.
- Transação com lock na original cria a nova ordem, vínculo, Timeline nas duas O.S. e Auditoria. Chave por empresa/original evita duplicação após resposta perdida; conteúdo/autor diferente com a mesma chave retorna conflito. Falhas transacionais não deixam uma nova O.S. sem vínculo.
- FKs compostas isolam original e retorno por empresa e restringem o aceite vinculado à mesma O.S. original. API aceita somente um relato ISSUE; confirmação ACCEPTED ou relato de outra ordem não serve como origem. Cliente, empresa, valores e autor não são aceitos do browser.
- Vínculo e motivo são preservados, sem edição/remoção nesta interface. Exclusão de O.S./aceite referenciado é restringida pelo banco. Correções administrativas e política de retenção precisam de fluxo próprio.
- Operação de retorno é dedicada: não dispara os produtores da criação comum de WhatsApp, notificações, automações, webhooks, onboarding ou analytics. O registro fica disponível nas consultas operacionais de O.S. e no histórico transacional. Ações posteriores da nova O.S. seguem o comportamento normal desses módulos.
- Formulário preserva dados após falha, retém a chave de tentativa durante a montagem da tela, bloqueia envios simultâneos e pede confirmação antes de descartar. Não há rascunho offline ou garantia de recuperar dados após fechar/recarregar o navegador.

## Limites do incremento

A abertura não representa aprovação automática de garantia. O incremento documentado em `RETURN_COVERAGE_AUDIT.md` acrescenta avaliação comercial explícita: novos retornos aguardam decisão e bloqueiam cobrança vinculada; o gestor pode aprovar cobertura sem cobrança ou autorizar os fluxos normais de cobrança. Ainda faltam política automática de prazo/elegibilidade, materiais/custos, SLAs e encerramento do caso. Não presumir que WARRANTY significa serviço gratuito.

## Implantação

Aplicar a migração aditiva `20261119170000_service_order_returns` antes do tráfego. O pre-deploy existente da API em `apps/api/railway.json` já executa `pnpm prisma:migrate:deploy`; conferir uso desse arquivo no serviço. Migração acrescenta tabela, índices e FKs, incluindo índice composto no aceite. Nenhuma migração, mensagem externa ou escrita foi realizada em produção nesta validação.

## Validação local

- Prisma validate e diff após migração em PostgreSQL 17 sem divergência.
- Cinco testes HTTP PostgreSQL: concorrência/idempotência, preservação de cliente e financeiro, auth/função/tenant/payload, origem de relato, estados permitidos, negação de admissão e recuperação de tentativa, paginação e FKs. Pool limitado a três conexões e admissão simulada fazendo consulta real ao banco exercitam a prevenção de espera circular. Política comercial real de plano é substituída por stub, incluindo negação; assinatura JWT também é simulada.
- Suíte web completa: 120 arquivos e 958 testes aprovados, incluindo três novos contratos BFF.
- TypeScript API/web e build Vite aprovados.
- Chromium 320/390/1280 px: abrir retorno vinculado ao relato, perder resposta após commit/repetir sem duplicação, navegar original→retorno→original, descartar rascunho, consulta VIEWER e largura sem overflow. Contexto/login/admissão são simulados; retorno e histórico usam Nest/PostgreSQL locais reais. Sem teste de Safari físico, plano real ou conta em produção.

Testes exigem `RETURNS_TEST_DATABASE_URL=postgresql://nexo@127.0.0.1:55439/postgres` com Jest `src/service-orders/service-order-returns.postgres.spec.ts`. Nunca usam `DATABASE_URL` e limpam apenas suas fixtures.

Browser: Vite em 5173 e harness `apps/api/test/commerce-local-api.ts` com o banco isolado e `RETURNS_AUDIT=1`, somente loopback 55440. Script `scripts/audits/service-order-returns.cjs` requer Playwright. Não iniciar harness em produção.
