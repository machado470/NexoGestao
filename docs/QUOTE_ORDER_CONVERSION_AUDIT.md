# Conversão de orçamento aprovado em O.S.

## Fluxo

ADMIN/MANAGER podem criar uma O.S. a partir da versão aprovada do orçamento. A ação aparece após a revisão dos itens/condições no detalhe. O vínculo é único por orçamento: tentativas simultâneas ou repetidas recuperam a mesma ordem. Se a ordem foi cancelada, o vínculo continua e a ação não cria outra. Novo atendimento exige outro orçamento/fluxo explícito.

A O.S. nasce aberta, com cliente, título, descrição dos itens/condições e total aprovados. Não copia responsável, agenda, vencimento, fotos ou checklist; não gera cobrança, pagamento, movimentação de estoque ou mensagem. O registro fica na Timeline do cliente/O.S. e na Auditoria. A aprovação por link continua sendo por nome autodeclarado, sem verificar identidade ou assinatura digital.

O detalhe do orçamento mostra a O.S. vinculada. O detalhe da O.S. mostra origem, versão, valor/moeda, autor/data e snapshot dos itens/condições, com navegação de volta ao orçamento exato. Consulta é permitida a STAFF/VIEWER. O histórico comercial permanece separado da evolução operacional.

## Valor e moeda

Conversão exige cliente ativo e a moeda atual da empresa igual à proposta, sem conversão cambial automática. Depois, o vínculo guarda a moeda aprovada. As duas entradas financeiras existentes usam essa moeda para cobranças vinculadas, mesmo se a moeda da empresa mudar posteriormente.

Valor e cliente da ordem vinculada não podem ser substituídos pelos fluxos comuns. O editor mantém o valor protegido e não o reenvia ao salvar outros campos; novas condições comerciais exigem outro orçamento enquanto adicionais aprovados não existirem. A API valida e o banco também bloqueia alteração dos termos, inclusive por caminhos alternativos. Descrição, situação, responsável e planejamento continuam nos fluxos operacionais existentes; alterar a descrição não muda o snapshot aprovado.

Cobrança vinculada deve corresponder ao total e à moeda aprovados. Isso não implementa parcelas, sinal, adicionais, desconto posterior ou nova forma de correção/estorno. Pagamentos e estornos já suportados seguem seus fluxos sobre a cobrança existente, sem editar o valor original. Cobranças avulsas não vinculadas a esta O.S. não são controladas por essa proteção.

Total zero cria tratamento QUOTE_NO_CHARGE: conclusão não gera cobrança e não é sinalizada como cobrança ausente pelos filtros/motores que usam a política comercial existente. Não é reutilizada uma isenção de retorno/garantia. Zero preserva sua natureza de serviço sem cobrança vinculada.

A O.S. comum ainda não tem moeda própria no seu DTO estabelecido. O painel de origem informa a moeda aprovada; após alteração da moeda da empresa, partes antigas da interface operacional que usam a preferência global ainda precisam de evolução geral para apresentar múltiplas moedas. A proteção de dados/cobrança da ordem convertida usa a moeda do vínculo, não essa preferência visual.

## Consistência e admissão

- Apenas orçamento ACCEPTED com resposta de aprovação da mesma versão pode converter. Expirar/revogar o acesso público depois de uma resposta não cancela a decisão comercial já registrada.
- Entrada recebe somente versão esperada. Cliente, valores, empresa e autor são derivados de registros/sessão, sem escolha pelo navegador.
- Vínculos compostos protegem empresa, orçamento, versão aprovada, resposta e ordem. Unicidade no orçamento/ordem e lock da proposta evitam duplicação. Snapshot/valor/moeda não mudam ao recuperar a ordem.
- Admissão usa QuotasService(CREATE_SERVICE_ORDER) antes da transação, sem segurar uma conexão esperando outra no mesmo pool. Recuperação de vínculo já existente dispensa nova admissão, inclusive com plano depois esgotado. Como no fluxo comum, esta verificação não reserva atomicamente o saldo global entre ordens de origens diferentes.
- Dentro da transação, orçamento e moeda atual são reconferidos, e O.S./vínculo/Timeline/Auditoria são gravados juntos. Falha não deixa ordem órfã ou vínculo incompleto.
- Triggers validam o vínculo e preservam cliente/valor/tratamento da ordem e valor/moeda/cliente da cobrança. Valor zero não admite cobrança vinculada. A tabela de vínculo não tem edição pela API.
- DTO estrito antigo de O.S. não recebe novos campos; origem é consultada em endpoint próprio. Metadados de conversão no orçamento são opcionais para deploy gradual. Formulário de O.S. com consulta de origem indisponível preserva o valor, permitindo salvar outros campos.

## Implantação

Migração `20261119220000_quote_order_conversion` antes da nova API pelo pre-deploy Railway. Acrescenta tabela/FKs/índices e triggers; expande billingTreatment para QUOTE_NO_CHARGE. Não reclassifica ordens antigas. Publicar o web depois da API.

Rollback exige cuidado: manter tabela e triggers para preservar obrigações. A API antiga não conhece a moeda do vínculo ao gerar cobranças e pode receber bloqueio do banco; uma ordem convertida de moeda diferente de BRL precisa da nova API. Não remover proteção nem converter moedas em massa como rollback automático. Nenhuma escrita/migração em produção nesta validação.

## Validação local

Sete testes HTTP Nest/PostgreSQL 17: aprovação/funções/empresa/payload, oito conversões concorrentes, recuperação com plano esgotado/ordem cancelada, admissão/cliente/moeda, total zero e ausência de falso risco, ambos escritores financeiros reais em USD após mudança da empresa para BRL, e guardas SQL/ordem comum. Consulta comercial é stub com leitura real pelo mesmo pool limitado a três conexões; JWT/contexto são simulados. Não valida assinatura real do plano.

Regressões de orçamento e cobertura de retorno também exercitadas no PostgreSQL. Suítes gerais: API 191 suítes/1320 testes e web 124 suítes/971 testes aprovados; TypeScript, Prisma diff e build Vite. Auditoria Chromium 320/390/1280 px: criar/aprovar proposta, converter com resposta perdida e duplo clique, recuperar a mesma ordem, navegar orçamento→O.S.→origem, ler itens e consultar por função. Autenticação e leituras gerais do módulo de O.S. são simuladas; catálogo, orçamento, conversão, origem e histórico usam API/banco reais locais. Não valida Safari físico ou produção.

Banco obrigatório: `QUOTE_ORDER_TEST_DATABASE_URL=postgresql://nexo@127.0.0.1:55439/postgres`, arquivo `apps/api/src/commerce/quote-order.postgres.spec.ts`. Teste usa somente esse banco explícito e remove suas próprias fixtures. Browser: `scripts/audits/quote-order-conversion.cjs`, Vite e harness `commerce-local-api.ts` no loopback 55440 com COMMERCE_TEST_DATABASE_URL igual ao banco isolado.
