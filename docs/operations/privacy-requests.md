---
status: review
owner: NOT_ASSIGNED
last_reviewed: 2026-11-12
source_of_truth: false
---

# Atendimento a solicitações de privacidade — procedimento em revisão

Este procedimento organiza o trabalho manual possível com o produto atual. Não atesta conformidade legal, existência de equipe designada, recebimento do e-mail publicado nem política de retenção aprovada. Código/schema são autoridade para capacidades; decisões de identidade, base legal, retenção e destinatário exigem responsável identificado no caso. Não há exclusão/anonimização global automática.

## Pré-condições e responsáveis pendentes

| Dependência | Estado | Evidência necessária para concluir |
| --- | --- | --- |
| Responsável pelo atendimento e substituto | NOT_ASSIGNED | Nome/papel, contato controlado, cobertura e escalonamento registrados fora do Git |
| Canal `privacy@nexogestao.com.br` | NOT_VERIFIED | Recebimento e resposta de teste confirmados pelo responsável; não enviar dados reais para provar o canal |
| Responsabilidades de controlador/operador | DECISION_REQUIRED | Identificar quem decide e executa em cada contexto contratual, incluindo pedidos de usuários e clientes finais |
| Critérios de identidade e representação | DECISION_REQUIRED | Método proporcional aprovado, referência da verificação e regras para procurador/representante |
| Prazos legais/operacionais | DECISION_REQUIRED | Prazo e marco inicial definidos pelo responsável conforme solicitação e legislação aplicável |
| Retenção por categoria e legal hold | DECISION_REQUIRED | Matriz aprovada com justificativa, prazo, responsável, método e alcance em backups/provedores |
| Canal de entrega e descarte do pacote | DECISION_REQUIRED | Destinatário verificado, acesso mínimo, validade, proteção e prova de recebimento |

Não preencher essas lacunas com nomes ou prazos presumidos. As permissões ADMIN/MANAGER da API autorizam exportação operacional; não substituem identificação do titular nem aprovação da entrega.

## Procedimento por caso

1. **Receber e registrar:** abrir um protocolo em repositório de atendimento restrito fora do Git, baseado no [modelo](privacy-request.example.md). Registrar tenant, tipo de pedido, data, responsável e prazo aprovado. Não copiar documentos de identidade, senhas, tokens ou todo o conteúdo recebido para logs/tickets amplamente acessíveis.
2. **Verificar identidade/representação:** usar o método aprovado e registrar apenas a referência necessária da prova. Resolver o tenant e os IDs corretos; coincidência de nome/e-mail não prova identidade. Enquanto pendente, estado `IDENTITY_PENDING`: não preparar entrega nem executar alteração irreversível.
3. **Inventariar:** usar o mapa abaixo, confirmar relações e identificar dados de terceiros. Registrar categorias encontradas, ausentes, inacessíveis e limitações de paginação. Um CSV ou workspace não é exportação completa do titular.
4. **Decidir escopo e retenção:** responsável define acesso/correção/restrição/exclusão aplicável, dados a preservar e motivos. Não apagar financeiro, histórico, auditoria ou fatos de consumo para satisfazer uma solicitação sem decisão registrada. Falta de decisão mantém o caso `RETENTION_REVIEW_PENDING`.
5. **Preparar pacote mínimo:** usar conta operacional permitida, tenant autenticado e filtros por ID. Retirar dados de terceiros e segredos; revisar textos livres, metadados, URLs e anexos. Registrar hash, contagens, escopo e request IDs no protocolo restrito, sem copiar conteúdo pessoal para a auditoria do produto.
6. **Revisar e entregar:** aprovação por pessoa designada, destinatário verificado e canal aprovado. A geração do CSV é registrada no produto; esse evento não prova envio ou recebimento. Registrar confirmação de entrega e eventuais limitações/recusas fundamentadas no protocolo.
7. **Executar decisões aprovadas:** correções pelos fluxos existentes preservam auditoria e controle de versão. Desativação não remove dados pessoais. Exclusão/anonimização exige plano próprio por categoria, tratamento de vínculos/terceiros, proteção dos registros financeiros e de consumo, dependências externas, backup anterior e prova posterior. Esta etapa não fornece comando global de DELETE.
8. **Fechar e acompanhar:** registrar resultado, prova de revisão/recebimento, pendências em provedores/backups, decisão de descarte do pacote temporário e prazo aprovado de retenção do próprio caso. Remoção do pacote temporário não equivale à exclusão dos dados de origem.

## Inventário mínimo e decisões de retenção

| Categoria / fontes atuais | Localização/limites | Tratamento a decidir |
| --- | --- | --- |
| Conta e pessoa: User, Person | Identidade e vínculo por tenant; desativação preserva campos | Acesso, correção, revogação e eventual anonimização; excluir credenciais/tokens de qualquer pacote de entrega |
| Cadastro: Customer | Nome, e-mail, telefone, CPF/CNPJ, endereço, notas e ativo | CSV só contém parte dos campos; revisar dado completo e texto livre antes de entregar |
| Agenda e O.S.: Appointment, ServiceOrder | Cliente, responsável, notas, descrição e conclusão | Revisar referências e informação de terceiros; preservar obrigações contratuais justificadas |
| Anexos: ServiceOrderAttachment e armazenamento de arquivos | Schema guarda metadados/URL; arquivo pode estar fora do PostgreSQL | Identificar blob/provedor, cópias e permissões; inventário do banco não comprova descarte externo |
| Financeiro: Charge, Payment, PaymentRefund, Invoice, Expense, Launch | Cliente, datas, valores, notas e documentos | Retenção/obrigações legais a aprovar; não reescrever liquidação, estorno ou períodos históricos |
| Histórico e risco: TimelineEvent, AuditEvent, avaliações/risco, trilhas e ações | IDs e dados pessoais também podem aparecer em JSON/texto livre | Revisar acesso e minimização sem apagar prova de autoria ou fatos comerciais; prazo a aprovar |
| WhatsApp: conversas, mensagens, webhook events, ações e provedor | Conteúdo, participantes, telefone e envelopes | Revisão de terceiros, cópias externas e recibos; nenhum descarte do provedor foi comprovado |
| Notificações, UsageMetric, IdempotencyRecord, OperationalOutboxEvent e entregas de webhook | Texto/JSON/respostas podem repetir dados de origem | Incluir no inventário, limitar acesso e preservar fatos de consumo durante a janela comercial |
| Cookies, logs, observabilidade, backups e réplicas | Podem ficar fora do banco/aplicação principal | Identificar responsáveis e lifecycle; restauração futura deve considerar pedidos aprovados sem invalidar retenção legal |

Todos os prazos desta matriz permanecem `DECISION_REQUIRED`. A existência de `RETENTION_DAYS` nos scripts de backup não define retenção legal dos dados do titular. Remover registros operacionais pode reduzir os medidores comerciais derivados desses fatos; revisar a preservação do consumo antes de qualquer política de exclusão.

## Preparação técnica por cliente

Endpoints atuais (prefixo padrão `/v1`), com token da organização e papel ADMIN ou MANAGER:

- `GET /customers/export?customerId=<UUID>`: CSV do cadastro selecionado; sem filtro continua exportando a organização inteira.
- `GET /finance/charges/export?customerId=<UUID>`: cobranças do cliente selecionado; sem filtro exporta as cobranças da organização. O recorte não inclui pagamentos/estornos como pacote completo.
- `GET /customers/<UUID>`: cadastro detalhado, sujeito à revisão manual antes de compor pacote.
- `GET /customers/<UUID>/workspace`: amostra contextual, limitada a 50 agendas, 50 O.S., 50 cobranças e 200 eventos. Não é prova de inventário completo.

As exportações filtradas conferem cliente no tenant autenticado. IDs de outro tenant ou ausentes retornam 404; UUID inválido/vazio/repetido retorna 400. Headers/query `orgId` não selecionam outra organização. STAFF/VIEWER não podem exportar esses CSVs. `Cache-Control: no-store` sinaliza que o conteúdo não deve ser mantido por caches; não apaga downloads locais.

A API registra `CUSTOMERS_EXPORTED`/`CHARGES_EXPORTED`, autor, entidade, formato, escopo e contagem. O conteúdo do CSV não é copiado para metadata. Falha na gravação da auditoria impede liberar o CSV pelo fluxo HTTP. Manter protocolo e prova de entrega no registro de atendimento, pois o produto não implementa workflow de casos.

Exemplo de preparação em diretório protegido, com parâmetros reais fornecidos pelo operador autorizado, sem tokens em argumentos, histórico ou Git:

```bash
set -euo pipefail
: "${PRIVACY_CASE_DIR:?Diretório exclusivo do caso obrigatório}"
: "${PRIVACY_CURL_CONFIG:?Configuração de autenticação obrigatória}"
: "${PRIVACY_API_BASE:?URL da API obrigatória}"
: "${PRIVACY_CUSTOMER_ID:?ID conferido do cliente obrigatório}"
umask 077
# O arquivo curl-privacidade.conf deve existir fora do Git, modo 0600,
# com header Authorization configurado por mecanismo autorizado.
mkdir -m 700 "$PRIVACY_CASE_DIR"
curl --fail --silent --show-error --config "$PRIVACY_CURL_CONFIG" \
  "$PRIVACY_API_BASE/v1/customers/export?customerId=$PRIVACY_CUSTOMER_ID" \
  --output "$PRIVACY_CASE_DIR/customer.csv"
curl --fail --silent --show-error --config "$PRIVACY_CURL_CONFIG" \
  "$PRIVACY_API_BASE/v1/finance/charges/export?customerId=$PRIVACY_CUSTOMER_ID" \
  --output "$PRIVACY_CASE_DIR/charges.csv"
sha256sum "$PRIVACY_CASE_DIR/customer.csv" "$PRIVACY_CASE_DIR/charges.csv"
```

Revisar HTTPS, caminhos, destinatário e campos antes de executar. Não usar os CSVs sem filtro da organização como resposta direta a um único titular. A amostra acima prepara arquivos; não verifica identidade, não envia mensagens e não apaga dados.

## Critérios de aceite do processo completo

Concluir o AU11 requer responsáveis designados, canal comprovado, identidade e retenção aprovadas, inventário completo por caso, revisão/entrega controlada, prova de alterações permitidas e tratamento de provedores/backups. Os testes técnicos locais provam recorte/permissão/auditoria; não substituem esses critérios. O procedimento segue em revisão até que as evidências operacionais sejam anexadas pelo responsável.
