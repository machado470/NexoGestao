import {
  assignOperationalPriority,
  classifyInboundIntent,
  computeSlaStatus,
  generateSuggestedActions,
  WhatsAppIntelligenceService,
} from './whatsapp-intelligence.service'

describe('WhatsApp deterministic operational intelligence', () => {
  it.each([
    ['vou pagar no pix agora', 'PAYMENT_INTENT'],
    ['preciso remarcar para outro horário', 'RESCHEDULE_INTENT'],
    ['não vou conseguir, pode cancelar?', 'CANCELLATION_INTENT'],
    ['tenho uma reclamação, não gostei do serviço', 'COMPLAINT_INTENT'],
    ['quanto custa? preciso de orçamento', 'QUOTE_REQUEST_INTENT'],
    ['já chegou? qual o andamento?', 'SERVICE_STATUS_INTENT'],
    ['olá bom dia', 'GENERAL_INTENT'],
  ])('classifica %s como %s', (content, expected) => {
    expect(classifyInboundIntent(content)).toEqual(expect.objectContaining({ intent: expected }))
  })

  it('atribui prioridade crítica por reclamação, cobrança vencida e mensagens repetidas sem resposta', () => {
    const decision = assignOperationalPriority({
      intent: 'COMPLAINT_INTENT',
      status: 'WAITING_OPERATOR',
      lastInboundAt: new Date('2026-05-06T10:00:00Z'),
      lastOutboundAt: new Date('2026-05-06T08:00:00Z'),
      now: new Date('2026-05-06T10:10:00Z'),
      context: {
        chargeId: 'ch1',
        chargeStatus: 'OVERDUE',
        serviceOrderId: 'so1',
        serviceOrderStatus: 'OPEN',
        repeatedInboundWithoutResponse: 3,
      },
    })

    expect(decision.priority).toBe('CRITICAL')
    expect(decision.reason).toContain('score determinístico')
    expect(decision.factors).toEqual(expect.arrayContaining([expect.stringContaining('reclamação')]))
  })

  it('computa SLA breached quando resposta vence conforme prioridade', () => {
    const decision = computeSlaStatus({
      priority: 'HIGH',
      lastInboundAt: new Date('2026-05-06T09:00:00Z'),
      lastOutboundAt: new Date('2026-05-06T08:00:00Z'),
      now: new Date('2026-05-06T10:30:00Z'),
    })

    expect(decision.slaStatus).toBe('BREACHED')
    expect(decision.waitingSince?.toISOString()).toBe('2026-05-06T09:00:00.000Z')
    expect(decision.responseDueAt?.toISOString()).toBe('2026-05-06T10:00:00.000Z')
  })

  it('gera ações sugeridas determinísticas com entidade relacionada', () => {
    const suggestions = generateSuggestedActions({
      intent: 'SERVICE_STATUS_INTENT',
      priority: 'HIGH',
      slaStatus: 'OK',
      context: { serviceOrderId: 'so1', serviceOrderStatus: 'IN_PROGRESS', chargeId: 'ch1', chargeStatus: 'PENDING' },
    })

    expect(suggestions).toEqual(expect.arrayContaining([
      expect.objectContaining({ action: 'SEND_PAYMENT_LINK', relatedEntity: { entityType: 'CHARGE', entityId: 'ch1' } }),
      expect.objectContaining({ action: 'SEND_SERVICE_UPDATE', relatedEntity: { entityType: 'SERVICE_ORDER', entityId: 'so1' } }),
    ]))
  })

  it('avalia inteligência explicável fim-a-fim sem LLM', () => {
    const service = new WhatsAppIntelligenceService()
    const decision = service.evaluate({
      content: 'não gostei, problema no serviço',
      lastInboundAt: new Date('2026-05-06T09:00:00Z'),
      lastOutboundAt: null,
      now: new Date('2026-05-06T09:20:00Z'),
      context: { customerId: 'c1' },
    })

    expect(decision.intent.intent).toBe('COMPLAINT_INTENT')
    expect(decision.explanation.rules).toContain('intent-keyword-match')
    expect(decision.suggestedActions[0]).toEqual(expect.objectContaining({ action: 'ESCALATE_TO_OPERATOR' }))
  })
})
