# Aceite do cliente por link — primeira entrega

## Fluxo entregue

Após concluir uma O.S., ADMIN/MANAGER/STAFF podem revisar um título e um resumo específicos para o cliente e gerar um link válido por 72 horas. O sistema não envia mensagens: o profissional copia o link e compartilha pelo canal combinado. VIEWER consulta o histórico interno, sem gerar ou revogar links.

O cliente abre `/service-acceptance#TOKEN`, sem conta, informa o nome, escolhe confirmar a entrega ou apontar um problema e confirma explicitamente o envio. Problema exige relato com pelo menos dez caracteres. A resposta é única e fica registrada com data do servidor; uma tentativa repetida com a mesma chave e conteúdo recupera o resultado sem criar outro evento. Outra decisão ou conteúdo no mesmo link retorna conflito.

Nome é autodeclarado. Qualquer pessoa com o link pode responder: não há verificação de identidade, OTP, assinatura digital ou certificação. A interface informa essa limitação e orienta não encaminhar o link. O proprietário precisa entregá-lo ao destinatário correto. Aceite não marca pagamento, não altera cobrança e não muda o status da O.S.; problema registrado não abre garantia ou retrabalho automaticamente.

## Compartilhamento e proteção

- Compartilha somente nome da empresa, título/resumo revisados, validade e situação/data da resposta. Não expõe IDs internos, contatos, valores, notas internas, fotos ou checklist automaticamente. Texto digitado pela equipe é conteúdo público para o portador do link e precisa ser revisado antes de gerar.
- O token fica no fragmento do link, não no path/query. A página o envia somente no corpo de POST para consulta e resposta; ambas as respostas BFF/API são privadas e sem cache. A página usa `noindex/nofollow` e `no-referrer`. Não habilitar logs de bodies dessas rotas. O fragmento continua no histórico/endereço do navegador e pode ser copiado por quem possui o link.
- Banco guarda SHA-256 do token. Para recuperar a mesma criação após resposta perdida, o token é derivado com HMAC-SHA256, separado por domínio/empresa/O.S./chave de tentativa, usando `JWT_SECRET` já exigido pela aplicação. Manter o segredo forte e igual entre réplicas. Rotação do segredo impede recuperar o token de uma tentativa antiga, mas links já entregues continuam verificáveis pelo hash até expirar/revogar; gerar outro link se necessário. Revogar antes da rotação quando o objetivo for cancelar acesso.
- Somente O.S. DONE gera solicitações. O resumo é um snapshot; mudança de status ou `updatedAt` depois da geração invalida a solicitação ainda sem resposta. Solicitar novo link após alteração. Histórico interno pode continuar sem resposta até gerar/revogar/expirar; não pressupor validade apenas por essa situação.
- Gerar outro link revoga todos os anteriores ainda pendentes. Respostas anteriores permanecem no histórico. Revogação explícita impede consulta/resposta pública, preservando o registro interno, inclusive quando já respondido.
- Até 20 solicitações por O.S. nesta versão. História não é editável/apagável pela interface. Retenção, exportação de comprovante e gerenciamento administrativo do limite são evoluções posteriores.
- FK composta e endpoints internos tenant-scoped; identidade da equipe vem da sessão. Lock da O.S. serializa geração, revogação e resposta. Timeline e Auditoria são gravadas junto da operação; tokens não entram nesses eventos. Mudanças do cliente nunca são atribuídas ao usuário interno como se fossem ações dele.
- Formulário interno preserva resumo em falha e confirma descarte. Formulário público preserva resposta em falha, mantém a chave de tentativa e bloqueia envio simultâneo. Não há rascunho offline. Trocar o fragmento na mesma aba carrega a nova solicitação, limpa dados da anterior e ignora respostas antigas que chegarem atrasadas.

## Implantação

Aplicar a migração aditiva `20261119160000_customer_acceptance` antes do tráfego da nova versão. O pre-deploy existente em `apps/api/railway.json` executa `pnpm prisma:migrate:deploy`; conferir que o serviço o utiliza. Não exige um provedor de e-mail/WhatsApp, mas depende do `JWT_SECRET` existente. Não houve migração, envio a terceiros ou gravação em produção nesta auditoria.

## Evidência local

- Sete testes HTTP com PostgreSQL 17 real: conteúdo público mínimo; autenticação/função/tenant; validação da confirmação com pipe de produção; concorrência/replay e resposta imutável; revogação sem apagar histórico; substituição/expiração/invalidação por mudança da O.S.; registro de problema; limite e FK composta. Identidade privada é simulada no harness; não valida assinatura JWT real.
- Suíte web completa: 119 arquivos, 955 testes aprovados, incluindo quatro novos testes BFF que verificam POST com token no corpo, contratos públicos, inputs forjados e proteção das operações internas.
- TypeScript API/web, build Vite e Prisma diff entre banco local migrado e schema sem divergência.
- Auditoria Chromium em 390, 320 e 1280 px com duas sessões: profissional e cliente anônimo. Contexto/login são simulados; criação, resposta e revogação usam API Nest/PostgreSQL locais reais. Exercita perda de resposta após commit, repetição sem duplicação, confirmação/problema, histórico, revogação com falha recuperável, ausência do token nas URLs das requisições e navegação entre dois links por fragmento na mesma aba. Não valida entrega por canal real, Safari físico ou conta em produção.

Teste HTTP opt-in: `ACCEPTANCE_TEST_DATABASE_URL=postgresql://nexo@127.0.0.1:55439/postgres` com Jest `src/service-orders/service-order-acceptance.postgres.spec.ts`. Nunca usa `DATABASE_URL` e remove somente suas fixtures.

Auditoria de navegador: Vite em 5173 e harness `apps/api/test/commerce-local-api.ts` com `COMMERCE_TEST_DATABASE_URL` do banco isolado e `ACCEPTANCE_AUDIT=1`, em loopback 55440. Executar `scripts/audits/customer-acceptance.cjs` com Playwright. Não iniciar o harness em produção.

## Continuação

A abertura de retorno ligado ao problema recebeu o incremento documentado em `docs/SERVICE_ORDER_RETURNS_AUDIT.md`. Política de cobertura/isenção, modelos de checklist, materiais e margem seguem no plano consolidado. Confirmação por identidade verificada, comprovante exportável e compartilhamento explícito de fotos devem ser tratados em incrementos próprios.
