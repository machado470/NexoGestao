# Fotos privadas de execução — primeira entrega

## O que mudou

A página de O.S. apresenta Fotos da execução antes do contexto recolhível no celular. ADMIN, MANAGER e STAFF podem registrar uma foto, relato de 5–1000 caracteres e confirmação explícita do profissional em O.S. em execução ou concluída. VIEWER apenas consulta, conforme as permissões existentes por empresa. Restrição de prestador aos próprios serviços é uma etapa futura do plano, não implementada por este fluxo.

O autor vem da sessão persistida; identificador do usuário, nome disponível e data do servidor acompanham o registro. A operação também grava Timeline e Auditoria na mesma transação. Não modifica o status da O.S., não exige foto para concluir e não representa aceite do cliente ou assinatura. O backend legado de URLs de anexos continua separado: não foi habilitado para receber URLs arbitrárias pela interface.

## Persistência e limites

- Fotos privadas em PostgreSQL, tabela `ServiceOrderEvidence`, com FK composta de O.S./empresa. Não existe URL pública. Metadados e conteúdo têm endpoints autenticados distintos; o JPEG só é consultado ao abrir a foto.
- O navegador aceita JPEG, PNG e WebP, decodifica e converte em JPEG de até 64 KB, com até 1280 px no maior lado. O canvas remove os metadados originais. Original de até 20 MB/50 MP; HEIC não é suportado nesta versão. A tela orienta guardar o original, pois a imagem persistida é otimizada.
- API valida base64 canônico, assinatura inicial/final JPEG e tamanho. Não faz perícia de autenticidade da imagem, validação de todo o codec ou antivírus. Uma imagem não comprova sozinha a execução ou a concordância do cliente.
- Até 12 registros por O.S.; lock da O.S. serializa uploads para impor o limite também sob concorrência. Não há edição/remoção nesta interface. Correções devem ser registradas em novo relato/foto, observando o limite; retenção e descarte administrativo precisam de fluxo próprio antes de ampliar o uso.
- Chave de tentativa por empresa/O.S. impede repetição por falha de transporte. Conteúdo ou autor diferente com a mesma chave retorna conflito. Confirmações com a mesma imagem após um salvamento já reconhecido são novos registros intencionais.
- A foto é mantida no formulário após falha; há bloqueio de envio concorrente e confirmação para descartar. A chave é preservada durante a montagem da tela, inclusive ao reabrir o modal. Não há persistência offline nem garantia de recuperar rascunho após fechar/recarregar o navegador.

Esta opção evita dependência de um provedor externo na primeira entrega, com carga limitada por O.S. Antes de escalar volume, migrar conteúdo para object storage privado com política de retenção, quotas por empresa e URLs temporárias autorizadas. A tabela entra no dimensionamento de banco e backups. Não usar esta versão como arquivo de originais em alta resolução.

## Implantação

Aplicar a migração aditiva `20261119120000_service_order_evidence` antes de receber tráfego da nova versão. O pre-deploy da API em `apps/api/railway.json` já executa `pnpm prisma:migrate:deploy`; verificar que o serviço utiliza esse arquivo. Nenhuma migração nem gravação desta auditoria foi realizada em produção.

## Validação

- Prisma validate e diff entre banco local migrado e schema sem divergência.
- Cinco testes HTTP com PostgreSQL 17 real: repetição e atribuição de autor; acesso autenticado por função/empresa; payload forjado e conteúdo inválido; status antes/depois/cancelamento; concorrência com limite de 12 e ausência de eventos órfãos. JWT é substituído por identidade local no harness, sem validar assinatura de token real.
- Quatro testes BFF: caminhos privados/contratos, identidade forjada, entradas inválidas e sessão ausente; suíte web completa com 117 arquivos/948 testes aprovada.
- TypeScript web/API e build Vite verificados.
- Auditoria Chromium em 390 px escuro, 320 px claro e desktop 1280 px. Autenticação e contexto da O.S. são simulados; upload, persistência e leitura de fotos usam Nest/PostgreSQL locais reais. Exercita PNG→JPEG, resposta perdida após commit, repetição com a mesma chave, visualização, descarte e ausência de escrita para VIEWER. Não substitui Safari/câmera física ou teste com conta real em produção.

Teste HTTP opt-in: `EVIDENCE_TEST_DATABASE_URL=postgresql://nexo@127.0.0.1:55439/postgres` e Jest `src/service-orders/service-order-evidence.postgres.spec.ts` no workspace da API. O teste recusa outro banco e limpa somente as organizações que criou.

Auditoria browser: iniciar `apps/api/test/commerce-local-api.ts` com o banco local isolado e Vite em 5173, depois executar `scripts/audits/service-order-photo-evidence.cjs` com Playwright disponível. O harness só escuta loopback em 55440 e não deve rodar em produção.

## Continuação

O plano completo está em `docs/product/PLANO_EVOLUCAO_NEXO_2026_11.md`. O checklist foi tratado no incremento documentado em `docs/SERVICE_ORDER_CHECKLIST_AUDIT.md`. Permanecem pendentes aceite seguro do cliente, assinatura, garantia/retrabalho, consumo de materiais, fotos originais e operação offline. Não considerar a etapa inteira de execução comprovada encerrada com estas entregas iniciais.
