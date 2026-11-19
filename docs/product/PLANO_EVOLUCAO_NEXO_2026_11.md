# Plano consolidado de evolução do NexoGestão

Atualizado em 19/11/2026. Propostas reunidas da revisão de páginas e dos cenários reais de prestadores. Este plano não declara funcionalidades futuras como entregues.

## Direção do produto

Fechar primeiro o ciclo de prestadores: orçamento → aprovação → agendamento → execução com evidências → aceite → cobrança → recebimento → garantia. Estoque, documentos fiscais e resultado financeiro devem aproveitar esses registros. E-commerce completo é uma expansão posterior.

Todas as fases devem manter isolamento por empresa, permissões na API, valores por moeda, rastreabilidade, recuperação de falhas sem duplicação e dados preservados após erro. Mobile: resumo curto, uma ação principal e detalhes sob demanda; testar 320/390 px, temas, teclado e área segura.

## Etapas e critérios de entrega

| Etapa | Propostas reunidas | Critério para considerar entregue |
| --- | --- | --- |
| 1. Execução comprovada | Fotos privadas por O.S., relato e confirmação do profissional; checklist, materiais, horários, tentativa sem atendimento, aceite do cliente e retorno em garantia | Evidências recuperáveis com autor/data; tentativa repetida não duplica; cliente só dá aceite por fluxo próprio; profissional não declara aceite em nome dele |
| 2. Antes do serviço | Catálogo de serviços/preços; múltiplos endereços e equipamentos; orçamento versionado, condições, aprovação e adicionais; contratos recorrentes/reajustes | É possível registrar o combinado e suas aprovações antes de executar; alterações preservam histórico |
| 3. Estoque e compras | Edição/arquivamento, ajuste com justificativa, histórico completo, alertas; fornecedores, compras, reservas, consumo/devolução por O.S., câmera para código de barras | Reserva não é consumo; repetição não baixa duas vezes; cancelamento libera reserva; custos ficam rastreáveis |
| 4. Financeiro completo | Recibos, estornos/correções, categorias e edição de despesas, histórico/exportação, contas a pagar, taxas, comissões/repasses, margem por serviço, comparação mensal; depois conciliação e previsão | Recebimento, reembolso, despesa e saldo restante conciliam por moeda; resultado registrado não é apresentado como lucro ou saldo bancário |
| 5. Fiscal real | Provedor, cadastro tributário, emissão, rejeição, consulta, XML/PDF autorizado, cancelamento | Documento só é exibido como emitido após autorização confirmada; repetição após timeout consulta antes de reenviar |
| 6. Relacionamento e crescimento | Área do cliente por link seguro, notificações/lembretes, recorrência e reagendamento, WhatsApp real e mídias; importação de clientes/produtos e duplicados; filiais/equipes/depósitos | Acesso mínimo, links revogáveis/expiráveis, falhas visíveis e sem mistura entre empresas/unidades |

## Revisão por página

- **Dashboard:** próxima ação única no celular, indicadores com origem navegável, menos repetição.
- **Clientes:** contato/pendência/ação primeiro; detalhes progressivos; endereços, equipamentos, importação e duplicados.
- **Agendamentos e Calendário:** recorrência, lembretes, reagendamento, tentativa sem atendimento e capacidade por profissional.
- **O.S.:** fotos/relato/checklist, adicionais aprovados, consumo, aceite, garantia e margem.
- **Financeiro:** recibo compartilhável, correções/estorno com justificativa e exportação.
- **Estoque:** completar manutenção do cadastro, histórico, ajustes, compras e vínculo com execução.
- **Notas fiscais:** manter preparação claramente separada de emissão enquanto não houver provedor real.
- **Saúde financeira:** categorizar/manter despesas, histórico completo, comparações e contas a pagar; conciliação/previsão depois.
- **WhatsApp:** finalizar ou retirar ações futuras do caminho principal; comprovar envio/recebimento/retry com provedor real.
- **Timeline:** paginação e filtros no servidor (hoje a página filtra somente os 50 eventos carregados).
- **Pessoas:** serviços/agenda por profissional, especialidades, comissões e acesso limitado de terceiros.
- **Governança:** explicar problema, impacto e ação em linguagem simples; preservar autoridade da API nas decisões.
- **Auditoria:** histórico de correções, antes/depois e exportação autorizada.
- **Planos:** validar contratação, recusa, mudança e cancelamento com cobrança real.
- **Perfil:** edição, foto, troca de senha, revogação de sessões; avaliar segundo fator.
- **Configurações:** empresa, dados fiscais, integrações e estado das conexões; convites e permissões.
- **Onboarding:** preservar opção de pular; testar empresa vazia, sem responsável e falha de conexão.
- **Login/cadastro/recuperação/convites:** validar e-mails reais, links expirados, confirmação e sessão revogada.
- **Site público/Contato:** registrar solicitações no servidor e confirmar recebimento; conferir contatos e promessas comerciais.
- **Cockpit e recuperação de webhooks:** falhas acionáveis, diagnóstico com rastreabilidade, repetição autorizada sem efeitos duplicados.

## Requisitos transversais

1. Operação com internet instável: rascunhos, filas/sincronização quando implementadas, indicação explícita do que não foi enviado; não prometer modo offline antes de existir.
2. Segurança e privacidade: permissões por função/atribuição, terceiros com acesso mínimo, retenção e exclusão de fotos/documentos, links privados, auditoria de acesso e revogação.
3. Portabilidade/continuidade: exportação, backup e restauração testada; runbook de deploy/rollback e monitoramento de falhas.
4. Acessibilidade e suporte: contraste, teclado, foco, leitores de tela, botões de toque, ajuda contextual e canal de suporte.
5. Prontidão real: percorrer empresa nova → equipe → atendimento → recebimento → resultado, incluindo internet lenta, sessão expirada e integração indisponível. Testes locais não substituem validação em produção ou Safari físico.

## Primeira entrega iniciada

Fotos otimizadas e privadas na O.S. em execução/concluída, com relato e confirmação do profissional. Nesta primeira entrega as imagens são pequenas e persistidas no PostgreSQL, com limite por O.S.; não há dependência de URLs públicas ou storage externo. Antes de escalar volume, migrar conteúdo para object storage privado e definir retenção.

O incremento seguinte adiciona checklist por O.S., com tarefas preparadas antes do atendimento, marcação durante execução, autor/data, motivo para desfazer e proteção por versão. Não é obrigatório para concluir o serviço; modelos, edição/arquivamento e exigência configurável permanecem futuros. Detalhes em `docs/SERVICE_ORDER_CHECKLIST_AUDIT.md`.

O próximo incremento oferece confirmação de entrega ou relato de problema por link de acesso de 72 horas, com resumo revisado, resposta única e revogação. Não verifica identidade nem representa assinatura digital; não envia mensagens automaticamente. Detalhes em `docs/SERVICE_ORDER_CUSTOMER_ACCEPTANCE_AUDIT.md`.

O incremento de retorno abre uma nova O.S. para o mesmo cliente, ligada à original e opcionalmente ao problema do aceite. Análise de garantia/retrabalho não aprova cobertura ou gratuidade; não copia financeiro, responsável ou agendamento e não envia mensagens na abertura. Detalhes em `docs/SERVICE_ORDER_RETURNS_AUDIT.md`.

Assinatura/identidade verificada, política completa de garantia/isenção, full-resolution e offline seguem pendentes; a etapa 1 ainda não está encerrada.

O incremento de cobertura acrescenta decisão comercial manual de gestor, com motivo, versão, autor e histórico. Retornos pendentes ou cobertos bloqueiam cobranças vinculadas; serviço cobrável segue os fluxos normais. Não cancela cobranças nem estorna pagamentos. Detalhes e limites em `docs/RETURN_COVERAGE_AUDIT.md`. Política automática de garantia, materiais/custos e encerramento do caso continuam pendentes.
