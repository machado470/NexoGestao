# Orçamento versionado e decisão por link

## Fluxo entregue

Página `/quotes` no menu Operação/Mais. ADMIN/MANAGER criam, revisam e compartilham; STAFF/VIEWER consultam detalhes, revisões e respostas. Usa as permissões de catálogo existentes. Cliente é selecionado entre ativos da empresa no cadastro; depois fica preservado. Trocar de cliente exige novo orçamento.

O orçamento contém título, condições escritas pela equipe e até dez itens do catálogo, com quantidade inteira de 1–1000 e preço unitário explicitamente informado. Preço de referência é sugerido e pode ser ajustado na proposta; item sob consulta exige preenchimento. Zero é permitido. O servidor calcula subtotais/total em centavos, com limite total de 2.147.483.647; total/nomes/estado não são aceitos do navegador. Sem impostos/descontos automáticos ou conversão cambial.

Cada item copia código, nome, descrição, duração e versão do catálogo. Serviço novo na proposta precisa estar ativo e na versão observada; se mudou, remover/adicionar novamente após conferir a seleção. Revisões podem preservar os serviços históricos já registrados, mesmo depois de edição/arquivamento no catálogo. A moeda da proposta permanece fixa e deve coincidir com a moeda de todos os itens; novo orçamento confirma a moeda atual da empresa.

Rascunho pode ser revisado com motivo, versão esperada e histórico completo. Compartilhar gera um link de 72 horas; gerar outro revoga o anterior ainda pendente. Revisão revoga links pendentes e volta a rascunho. Recusa permite revisar e compartilhar uma nova versão. Aprovação preserva a versão: novas condições exigem outro orçamento. Repetição de revisão já gravada pode recuperar o resultado, inclusive se essa versão foi aprovada depois, sem alterar os dados.

O destinatário confere itens, valores e condições, informa nome e confirma aprovação ou recusa; recusa exige motivo. Acesso é por posse do link, com nome autodeclarado: não verifica identidade nem representa assinatura digital. Não usar como promessa de assinatura qualificada. Link não é enviado automaticamente.

## Acesso e consistência

Token HMAC com domínio próprio, empresa/orçamento/chave aleatória e segredo JWT existente; banco armazena somente hash do token. O navegador usa fragmento `#`, e as consultas/respostas públicas usam POST, mantendo o token fora de caminhos e query strings. Respostas públicas não incluem cliente, contatos, ids internos, autores ou credenciais. Diagnósticos de inicialização HTML/React registram somente origem/caminho, sem query ou fragmento (também protege os links de aceite existentes). A auditoria de navegador verifica ausência dos tokens no console e no estado de diagnóstico. Página pública usa noindex/no-referrer; endpoints e BFF de orçamento usam no-store para acesso público. Prazo de 72 horas é validade do acesso, sem implementar uma política comercial distinta de validade da proposta.

Revogação bloqueia leitura/resposta do link e preserva o registro interno. Resposta já registrada permanece no histórico; seu comprovante público só é consultável enquanto o link estiver válido e não revogado. Recibos de versões recusadas não são substituídos por dados da revisão posterior. Estado Compartilhado não muda automaticamente ao expirar; a equipe consulta o prazo e pode gerar novo link.

Cadastro tem chave idempotente por empresa e compara a revisão inicial; após outras revisões, repetir a criação original retorna a situação atual. Revisão usa versão esperada e recupera repetição imediata de mesmo conteúdo, autor e motivo. Compartilhamento retém a chave após resposta perdida e só recupera link ainda utilizável. Resposta pública usa chave da tentativa e conteúdo; repetição igual não duplica histórico, resposta diferente conflita.

Locks na proposta serializam revisão, compartilhamento, revogação e resposta. Índice parcial permite um único link pendente por proposta; FKs compostas vinculam cliente/revisões/links à empresa e à versão. Proposta, revisão, Timeline do cliente e Auditoria são gravadas em transação. Falha não deixa revisão ou decisão parcial. Campos internos/autor não são escolhidos pelo cliente público. Histórico é preservado pela API e FKs, sem alegar proteção contra administrador direto do banco.

## Interface e limites

Cards resumem cliente, versão, total e situação; detalhes mostram conteúdo e ações. Histórico e respostas ficam sob demanda. Lista mostra dez propostas por página, revisões cinco por página e até dez links recentes. Busca de clientes/serviços mostra até 20 resultados por pesquisa. Formulários preservam dados após erro, bloqueiam duplo envio e confirmam descarte; refetch não troca silenciosamente a versão de um rascunho. Não há rascunho offline após fechar/recarregar.

Aprovar não cria O.S., agenda, cobrança, nota fiscal, reserva de estoque ou pagamento. Não envia mensagens ou notificações externas. Conversão controlada do orçamento aprovado em O.S., adicionais aprovados, cancelamento comercial, validade específica da oferta, impostos, PDF/exportação, política de assinatura/identidade e pagamento continuam futuros. O escopo atual fecha proposta e decisão, não o restante da execução.

## Implantação

Aplicar `20261119210000_service_quotes` antes da nova API: três tabelas, índices, FKs e constraints, em transação. O pre-deploy Railway existente em `apps/api/railway.json` executa migrações; publicar o web após a API. Sem backfill ou serviço externo novo. Segredo JWT deve permanecer configurado; rotação pode impedir recuperar uma tentativa de geração de link, sem apagar os registros.

Rollback de aplicação preserva tabelas, revisões e respostas. Não há reversão destrutiva automática. Nenhuma migração, mensagem ou escrita em produção nesta validação.

## Validação local

- Sete testes Nest/PostgreSQL 17: concorrência/idempotência, cálculo/overflow/zero, snapshot e revisão de catálogo arquivado, funções/empresa/payload, link/hash/expiração/revogação, recusa/revisão/aprovação e disputas aprovação×revisão/revogação. Verificam ausência de O.S./cobrança/estoque e restrição de exclusão.
- Contratos BFF de entradas/saídas e decisão pública: token no corpo POST, confirmação booleana explícita, nomes/valores e campos forjados rejeitados.
- Suítes gerais: 191 suítes/1320 testes API e 124 suítes/969 testes web; testes PostgreSQL opt-in executados separadamente. TypeScript API/web, build Vite e migration diff sem divergência.
- Auditoria Chromium 320/390/1280 px em `scripts/audits/service-quotes.cjs`: proposta com dois itens, cadastro/link/resposta com retorno perdido após commit, recusa anônima, revisão, aprovação de nova versão, histórico, descarte e funções de consulta. Autenticação/contexto e leitura de clientes são simulados; catálogo/orçamento/links/decisões usam Nest e PostgreSQL reais locais. Não valida plano real, Safari físico ou produção.

Banco dos testes: `QUOTES_TEST_DATABASE_URL=postgresql://nexo@127.0.0.1:55439/postgres`; arquivo `apps/api/src/commerce/service-quotes.postgres.spec.ts`. Não usa DATABASE_URL para escolher banco e limpa só fixtures próprias. Browser requer Vite 5173 e harness `commerce-local-api.ts` com `COMMERCE_TEST_DATABASE_URL` igual ao banco isolado, em loopback 55440.
