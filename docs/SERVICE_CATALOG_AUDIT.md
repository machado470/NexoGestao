# Catálogo de serviços e preços de referência

## Entrega

Nova página `/service-catalog`, acessível pelo menu Operação/Mais. ADMIN/MANAGER cadastram e editam; STAFF/VIEWER consultam catálogo e histórico. Filtros por nome/código e situação (ativos, arquivados, todos), paginação de 20 serviços. Histórico de dez revisões por página, com snapshot completo, motivo, autor e data; descrição e histórico ficam sob demanda no celular.

Cada serviço tem código próprio por empresa, nome, descrição, preço de referência opcional e duração opcional (1–10080 minutos). Código é normalizado para maiúsculas. Preço vazio significa sob consulta; zero permanece um valor explícito. Não é SKU de estoque nem lista de produtos.

Moeda é confirmada no cadastro e persistida no serviço. Alterar a moeda da empresa depois não converte preços anteriores. Edição preserva a moeda do serviço; novo cadastro usa a moeda atual. Valores são inteiros em centavos conforme a convenção financeira existente, sem conversão cambial.

Arquivar desativa o serviço da lista padrão, sem apagar histórico. O código atual continua reservado, inclusive para arquivados. É possível reativar com motivo. Alteração de código é registrada no histórico e libera o código anterior; não usar código como identidade estável de integrações futuras (usar id/versão).

## Consistência

Cadastro usa chave de tentativa por empresa. Repetir o mesmo conteúdo/autor recupera o registro sem duplicação, mesmo se o serviço já foi editado; a comparação usa o snapshot inicial e a resposta contém a versão atual. Conteúdo ou autor diferente com mesma chave retorna conflito. Código duplicado com outra chave retorna conflito.

Edição exige versão esperada e motivo de 10–1000 caracteres. Lock na linha serializa alterações; uma repetição imediata da mesma versão de origem, conteúdo, motivo e autor recupera a revisão. Disputa com outra alteração retorna 409. Dados da empresa/autor não vêm do formulário. Consultas e histórico são isolados por empresa; FK composta impede revisão apontar para serviço de outra empresa.

Cada alteração salva serviço, revisão e Auditoria na mesma transação. A API acrescenta revisões e não oferece remoção/edição do histórico ou exclusão definitiva. FK restringe exclusão de serviço com revisões. Não é um registro à prova de alteração por administrador direto do banco; retenção/exportação administrativa precisam de política própria.

Formulário mantém dados após falha, bloqueia envio simultâneo e pede confirmação de descarte. Uma versão de rascunho não é atualizada silenciosamente após refetch. Chaves de tentativa ficam na memória da página, sem garantia de retomada após recarregar/fechar; não há modo offline.

## Limites

Este é o cadastro de referência que prepara a etapa de orçamento. Não gera orçamento, aprovação, O.S., agendamento, reserva de capacidade, cobrança, documento fiscal, mensagem ou movimentação de estoque. Duração não bloqueia agenda e preço não é receita. Ordens e cobranças existentes não mudam ao editar o catálogo. Nenhum limite comercial de plano específico foi criado para este cadastro.

Próximo incremento: orçamento versionado com itens copiados por snapshot (nome, preço, moeda, duração e versão do serviço), condições e aprovação do cliente. Descontos/adicionais, impostos, múltiplos endereços/equipamentos e recorrência continuam futuros.

## Implantação

Migração aditiva `20261119200000_service_catalog`, com duas tabelas, índices, FKs e constraints de valores. Aplicar antes da nova API pelo pre-deploy de `apps/api/railway.json`. Não há backfill ou integração externa. O web deve ser publicado após a API que oferece o endpoint. Em rollback de aplicação, manter tabelas/revisões para preservar dados; não há rollback destrutivo automático.

Nenhuma escrita ou migração foi realizada em produção nesta validação.

## Validação local

- Cinco testes Nest/PostgreSQL 17: concorrência/repetição, código único, snapshot inicial, edição/arquivo/reativação, histórico, funções/tenant/payload, zero/sob consulta, mudança de moeda e paginação. JWT/contexto são simulados; operações e banco são reais. Verificam também ausência de escrita em O.S., cobrança e estoque e restrição de exclusão.
- Contratos BFF: paginação/histórico, zero/null, payload sem campos forjados, versão, autenticação e permissões da navegação mobile.
- Suítes gerais: API 191 suítes/1320 testes; web 123 suítes/965 testes aprovados. Testes de banco opt-in são executados separadamente.
- TypeScript API/web, build Vite e Prisma diff sem divergência.
- Chromium 320/390/1280 px, temas claro/escuro: criar/editar com resposta perdida após commit, repetir sem duplicar, arquivar/reativar, descartar rascunho, pesquisar, consultar histórico e funções de leitura. Contexto/login e demais leituras do app são simulados; catálogo usa API/PostgreSQL locais reais. Não valida produção ou Safari físico.

Teste de banco: `CATALOG_TEST_DATABASE_URL=postgresql://nexo@127.0.0.1:55439/postgres`, arquivo `apps/api/src/commerce/service-catalog.postgres.spec.ts`. Não usa DATABASE_URL como seleção de banco; limpa somente fixtures próprias. Browser: `scripts/audits/service-catalog.cjs`, Vite 5173 e harness `apps/api/test/commerce-local-api.ts` em loopback 55440 com `COMMERCE_TEST_DATABASE_URL` igual ao banco isolado.
