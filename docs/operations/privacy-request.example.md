# Modelo de protocolo de privacidade — sem dados reais

Armazenar preenchimento e evidências em sistema restrito fora do Git. Este modelo vazio não é caso atendido nem aprovação de retenção.

- Protocolo: `<referência interna>`
- Recebido em / canal: `<data e referência>`
- Organização / IDs internos do titular: `<tenant e IDs conferidos>`
- Tipo de pedido / escopo: `<acesso, correção, restrição, anonimização ou exclusão>`
- Responsável / substituto / aprovador: `NOT_ASSIGNED`
- Estado: `RECEIVED | IDENTITY_PENDING | INVENTORY | RETENTION_REVIEW_PENDING | APPROVED | DELIVERY_PENDING | COMPLETED | REJECTED`
- Verificação de identidade/representação: `PENDING`; método e referência mínima `<não anexar documento por padrão>`
- Papel contratual controlador/operador: `DECISION_REQUIRED`
- Marco inicial / prazo aplicável / fundamento aprovado: `DECISION_REQUIRED`
- Categorias encontradas, ausentes, incompletas e de terceiros: `<inventário e limites de paginação>`
- Bases/obrigações de retenção, legal hold e prazo por categoria: `DECISION_REQUIRED`
- Preparação: `<operador, instante, endpoints/filtros usados, request IDs, eventos de auditoria, contagens>`
- Pacote protegido: `<referência, hash SHA-256, revisão de terceiros/segredos e aprovação>`
- Entrega: `<destinatário verificado, canal aprovado, data, confirmação de recebimento>`
- Alterações permitidas: `<plano, aprovação, executor, auditoria, verificação posterior>`
- Provedores, arquivos externos e backups: `<pendências e evidências próprias>`
- Pacote temporário / retenção do protocolo: `<decisão aprovada, vencimento, executor e confirmação>`
- Encerramento / motivo / pendências comunicadas: `<resultado factual>`

Não preencher `COMPLETED` apenas porque um CSV foi gerado ou uma conta foi desativada.
