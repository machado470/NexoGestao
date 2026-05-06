import { WhatsAppService } from './whatsapp.service'
import { normalizePhone } from './phone.util'
import { QUEUE_NAMES, WHATSAPP_QUEUE_JOB_NAMES } from '../queue/queue.constants'

jest.mock('./providers/provider.factory', () => ({
  createWhatsAppProvider: () => ({
    getProviderName: () => 'meta_cloud',
    parseWebhook: jest.fn(() => [{
      eventType: 'MESSAGE_RECEIVED',
      fromPhone: '11 99999-9999',
      toPhone: '5511888888888',
      content: 'oi',
      providerMessageId: 'wamid.1',
      timestamp: new Date('2026-01-01T00:00:00Z'),
      metadata: {},
    }]),
  }),
}))

describe('WhatsAppService inbound/outbound', () => {
  it('normalize phone em E.164 com +55', () => {
    expect(normalizePhone('(11) 99999-9999')).toBe('+5511999999999')
    expect(normalizePhone('5511999999999')).toBe('+5511999999999')
  })

  it('inbound cria mensagem e não duplica webhook repetido', async () => {
    const prisma: any = {
      customer: { findFirst: jest.fn().mockResolvedValue({ id: 'c1', orgId: 'org1', phone: '+5511999999999' }) },
      whatsAppConversation: {
        findFirst: jest.fn().mockResolvedValue({ id: 'conv1', customerId: 'c1', phone: '+5511999999999' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      charge: { findFirst: jest.fn().mockResolvedValue(null) },
      appointment: { findFirst: jest.fn().mockResolvedValue(null) },
      serviceOrder: { findFirst: jest.fn().mockResolvedValue(null) },
      whatsAppMessage: {
        findFirst: jest.fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ id: 'm1', orgId: 'org1', providerMessageId: 'wamid.1' })
          .mockResolvedValue({ id: 'm1', orgId: 'org1', customerId: 'c1', providerMessageId: 'wamid.1', messageType: 'MANUAL', entityType: 'CUSTOMER', entityId: 'c1', conversationId: 'conv1', direction: 'INBOUND', status: 'DELIVERED' }),
        create: jest.fn().mockResolvedValue({ id: 'm1', createdAt: new Date(), entityType: 'CUSTOMER', entityId: 'c1', messageType: 'MANUAL', status: 'DELIVERED' }),
        count: jest.fn().mockResolvedValue(0),
      },
      timelineEvent: { findFirst: jest.fn().mockResolvedValue(null) },
    }
    const svc = new WhatsAppService(prisma, { addJob: jest.fn() } as any, { incOutbound: jest.fn(), incInbound: jest.fn(), incFailed: jest.fn(), incFailedWebhook: jest.fn(), incQueuedJobs: jest.fn(), observeProcessingDuration: jest.fn() } as any, { log: jest.fn().mockResolvedValue({}) } as any, { orgId: 'test-org', userId: 'test-user', requestId: 'test-request' } as any, { increment: jest.fn() } as any, { enforceMeter: jest.fn().mockResolvedValue({ allowed: true }) } as any)
    await svc.processInboundWebhook('meta_cloud', {}, { orgId: 'org1' })
    await svc.processInboundWebhook('meta_cloud', {}, { orgId: 'org1' })
    expect(prisma.whatsAppMessage.create).toHaveBeenCalledTimes(1)
    expect(prisma.whatsAppConversation.updateMany).toHaveBeenCalled()
  })

  it('inbound sem cliente retorna erro controlado', async () => {
    const prisma: any = {
      customer: { findFirst: jest.fn().mockResolvedValue(null) },
      whatsAppConversation: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'conv1', customerId: null, phone: '+5511999999999' }), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      whatsAppMessage: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'm1', createdAt: new Date(), customerId: null, conversationId: 'conv1', status: 'DELIVERED', providerMessageId: 'wamid.1', messageType: 'MANUAL', entityType: 'GENERAL', entityId: 'conv1', direction: 'INBOUND', errorMessage: null }), count: jest.fn().mockResolvedValue(0) },
      timelineEvent: { findFirst: jest.fn().mockResolvedValue(null) },
    }
    const svc = new WhatsAppService(prisma, { addJob: jest.fn() } as any, { incOutbound: jest.fn(), incInbound: jest.fn(), incFailed: jest.fn(), incFailedWebhook: jest.fn(), incQueuedJobs: jest.fn(), observeProcessingDuration: jest.fn() } as any, { log: jest.fn().mockResolvedValue({}) } as any, { orgId: 'test-org', userId: 'test-user', requestId: 'test-request' } as any, { increment: jest.fn() } as any, { enforceMeter: jest.fn().mockResolvedValue({ allowed: true }) } as any)
    const result = await svc.processInboundWebhook('meta_cloud', {}, { orgId: 'org1' })
    expect(result.results[0].context.contextType).toBe('GENERAL')
  })

  it('outbound enfileira envio async', async () => {
    const addJob = jest.fn().mockResolvedValue({ id: 'j1' })
    const prisma: any = {
      customer: { findFirst: jest.fn().mockResolvedValue({ id: 'c1', phone: '+5511999999999' }) },
      whatsAppConversation: { findFirst: jest.fn().mockResolvedValue({ id: 'conv1', customerId: 'c1', phone: '+5511999999999' }), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      whatsAppMessage: { create: jest.fn().mockResolvedValue({ id: 'm1', createdAt: new Date(), customerId: 'c1', conversationId: 'conv1', status: 'QUEUED' }) },
    }
    const svc = new WhatsAppService(prisma, { addJob } as any, { incOutbound: jest.fn(), incInbound: jest.fn(), incFailed: jest.fn(), incFailedWebhook: jest.fn(), incQueuedJobs: jest.fn(), observeProcessingDuration: jest.fn() } as any, { log: jest.fn().mockResolvedValue({}) } as any, { orgId: 'test-org', userId: 'test-user', requestId: 'test-request' } as any, { increment: jest.fn() } as any, { enforceMeter: jest.fn().mockResolvedValue({ allowed: true }) } as any)
    await svc.enqueueMessage('org1', { customerId: 'c1', content: 'oi', entityType: 'CUSTOMER', entityId: 'c1', messageType: 'MANUAL' })
    expect(addJob).toHaveBeenCalled()
  })

  it('emite eventos críticos MESSAGE_SENT e PAYMENT_LINK_SENT ao marcar envio confirmado', async () => {
    const timeline = { log: jest.fn().mockResolvedValue({}) }
    const prisma: any = {
      whatsAppMessage: {
        update: jest.fn().mockResolvedValue({
          id: 'm1',
          orgId: 'org1',
          customerId: 'c1',
          providerMessageId: 'wamid.1',
          messageType: 'PAYMENT_LINK',
          entityType: 'CHARGE',
          entityId: 'ch1',
          conversationId: 'conv1',
          direction: 'OUTBOUND',
          status: 'SENT',
          errorMessage: null,
        }),
        findFirst: jest.fn().mockResolvedValue({
          id: 'm1',
          orgId: 'org1',
          customerId: 'c1',
          providerMessageId: 'wamid.1',
          messageType: 'PAYMENT_LINK',
          entityType: 'CHARGE',
          entityId: 'ch1',
          conversationId: 'conv1',
          direction: 'OUTBOUND',
          status: 'SENT',
          errorMessage: null,
        }),
        count: jest.fn().mockResolvedValue(0),
      },
      timelineEvent: { findFirst: jest.fn().mockResolvedValue(null) },
    }
    const svc = new WhatsAppService(prisma, { addJob: jest.fn() } as any, { incOutbound: jest.fn(), incInbound: jest.fn(), incFailed: jest.fn(), incFailedWebhook: jest.fn(), incQueuedJobs: jest.fn(), observeProcessingDuration: jest.fn() } as any, timeline as any, { orgId: 'test-org', userId: 'test-user', requestId: 'test-request' } as any, { increment: jest.fn() } as any, { enforceMeter: jest.fn().mockResolvedValue({ allowed: true }) } as any)

    await svc.markSent({ id: 'm1', provider: 'zapi', providerMessageId: 'wamid.1' })

    expect(timeline.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'MESSAGE_SENT' }))
    expect(timeline.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'PAYMENT_LINK_SENT' }))
  })

  it('resolve contexto operacional com cobrança, agendamento e ordem vinculados', async () => {
    const prisma: any = {
      customer: { findFirst: jest.fn().mockResolvedValue({ id: 'c1', orgId: 'org1', phone: '+5511999999999' }) },
      charge: { findFirst: jest.fn().mockResolvedValue({ id: 'ch1' }) },
      appointment: { findFirst: jest.fn().mockResolvedValue({ id: 'ap1' }) },
      serviceOrder: { findFirst: jest.fn().mockResolvedValue({ id: 'so1' }) },
      whatsAppConversation: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'conv1', customerId: 'c1', phone: '+5511999999999' }), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      whatsAppMessage: {
        findFirst: jest.fn().mockResolvedValueOnce(null).mockResolvedValue({ id: 'm1', orgId: 'org1', customerId: 'c1', providerMessageId: 'wamid.1', messageType: 'MANUAL', entityType: 'CHARGE', entityId: 'ch1', conversationId: 'conv1', direction: 'INBOUND', status: 'DELIVERED', errorMessage: null }),
        create: jest.fn().mockResolvedValue({ id: 'm1', createdAt: new Date(), customerId: 'c1', conversationId: 'conv1', providerMessageId: 'wamid.1', messageType: 'MANUAL', entityType: 'CHARGE', entityId: 'ch1', direction: 'INBOUND', status: 'DELIVERED', errorMessage: null }),
        count: jest.fn().mockResolvedValue(0),
      },
      timelineEvent: { findFirst: jest.fn().mockResolvedValue(null) },
    }
    const timeline = { log: jest.fn().mockResolvedValue({}) }
    const svc = new WhatsAppService(prisma, { addJob: jest.fn() } as any, { incOutbound: jest.fn(), incInbound: jest.fn(), incFailedWebhook: jest.fn(), incQueuedJobs: jest.fn(), observeProcessingDuration: jest.fn() } as any, timeline as any, { orgId: 'test-org', userId: 'test-user', requestId: 'test-request' } as any, { increment: jest.fn() } as any, { enforceMeter: jest.fn().mockResolvedValue({ allowed: true }) } as any)

    const result = await svc.processInboundWebhook('meta_cloud', {}, { orgId: 'org1', traceId: 'trace-1', webhookEventId: 'wh-1' })

    expect(result.results[0].context).toEqual(expect.objectContaining({ contextType: 'CHARGE', chargeId: 'ch1', appointmentId: 'ap1', serviceOrderId: 'so1' }))
    expect(prisma.whatsAppMessage.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ entityType: 'CHARGE', entityId: 'ch1' }) }))
    expect(timeline.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'MESSAGE_RECEIVED' }))
  })

  it('emite timeline para status delivered/read/failed com deduplicação por mensagem', async () => {
    const timeline = { log: jest.fn().mockResolvedValue({}) }
    const prisma: any = {
      whatsAppMessage: {
        findFirst: jest.fn().mockResolvedValue({ id: 'm1', orgId: 'org1', customerId: 'c1', providerMessageId: 'wamid.1', messageType: 'MANUAL', entityType: 'CUSTOMER', entityId: 'c1', conversationId: 'conv1', direction: 'OUTBOUND', status: 'SENT', errorMessage: null }),
        count: jest.fn().mockResolvedValue(0),
        update: jest.fn().mockResolvedValue({ id: 'm1', orgId: 'org1', customerId: 'c1', providerMessageId: 'wamid.1', messageType: 'MANUAL', entityType: 'CUSTOMER', entityId: 'c1', conversationId: 'conv1', direction: 'OUTBOUND', status: 'DELIVERED', errorMessage: null }),
      },
      timelineEvent: { findFirst: jest.fn().mockResolvedValue(null) },
    }
    const svc = new WhatsAppService(prisma, { addJob: jest.fn() } as any, { incOutbound: jest.fn(), incInbound: jest.fn(), incFailedWebhook: jest.fn(), incQueuedJobs: jest.fn(), observeProcessingDuration: jest.fn() } as any, timeline as any, { orgId: 'test-org', userId: 'test-user', requestId: 'test-request' } as any, { increment: jest.fn() } as any, { enforceMeter: jest.fn().mockResolvedValue({ allowed: true }) } as any)

    await svc.updateMessageStatus('org1', { id: 'm1', status: 'DELIVERED' })
    await svc.updateMessageStatus('org1', { id: 'm1', status: 'READ' })
    await svc.updateMessageStatus('org1', { id: 'm1', status: 'FAILED', errorMessage: 'provider failed' })

    expect(timeline.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'MESSAGE_DELIVERED' }))
    expect(timeline.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'MESSAGE_READ' }))
    expect(timeline.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'MESSAGE_FAILED' }))
  })


  it('enfileira webhook inbound persistido com job dedicado e payload mínimo', async () => {
    const addJob = jest.fn().mockResolvedValue({ id: 'job1' })
    const metrics = { incInboundWebhookQueued: jest.fn() }
    const svc = new WhatsAppService({} as any, { addJob } as any, metrics as any, { log: jest.fn() } as any, { orgId: 'test-org', userId: 'test-user', requestId: 'test-request' } as any, { increment: jest.fn() } as any, { enforceMeter: jest.fn().mockResolvedValue({ allowed: true }) } as any)

    await svc.enqueueInboundWebhook({ webhookEventId: 'wh1', orgId: 'org1', provider: 'meta_cloud', traceId: 'trace-1', receivedAt: new Date('2026-05-06T00:00:00Z') })

    expect(addJob).toHaveBeenCalledWith(
      QUEUE_NAMES.WHATSAPP,
      WHATSAPP_QUEUE_JOB_NAMES.INBOUND_WEBHOOK,
      expect.objectContaining({ webhookEventId: 'wh1', orgId: 'org1', provider: 'meta_cloud', traceId: 'trace-1', receivedAt: '2026-05-06T00:00:00.000Z' }),
      { jobId: 'whatsapp:inbound-webhook:wh1' },
    )
    expect(metrics.incInboundWebhookQueued).toHaveBeenCalled()
  })

  it('worker usa webhook persistido e marca PROCESSED sem duplicar em retry', async () => {
    const event = { id: 'wh1', orgId: 'org1', provider: 'meta_cloud', payload: {}, status: 'RECEIVED' }
    const prisma: any = {
      whatsAppWebhookEvent: {
        findFirst: jest.fn().mockResolvedValue(event),
        update: jest.fn().mockResolvedValue({ ...event, status: 'PROCESSED' }),
      },
      customer: { findFirst: jest.fn().mockResolvedValue({ id: 'c1', orgId: 'org1', phone: '+5511999999999' }) },
      whatsAppConversation: { findFirst: jest.fn().mockResolvedValue({ id: 'conv1', customerId: 'c1', phone: '+5511999999999' }), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      charge: { findFirst: jest.fn().mockResolvedValue(null) },
      appointment: { findFirst: jest.fn().mockResolvedValue(null) },
      serviceOrder: { findFirst: jest.fn().mockResolvedValue(null) },
      whatsAppMessage: {
        findFirst: jest.fn().mockResolvedValueOnce(null).mockResolvedValue({ id: 'm1', orgId: 'org1', customerId: 'c1', providerMessageId: 'wamid.1' }),
        create: jest.fn().mockResolvedValue({ id: 'm1', createdAt: new Date(), entityType: 'CUSTOMER', entityId: 'c1', messageType: 'MANUAL', status: 'DELIVERED' }),
        count: jest.fn().mockResolvedValue(0),
      },
      timelineEvent: { findFirst: jest.fn().mockResolvedValue(null) },
    }
    const svc = new WhatsAppService(prisma, { addJob: jest.fn() } as any, { incInbound: jest.fn(), incFailedWebhook: jest.fn(), observeProcessingDuration: jest.fn() } as any, { log: jest.fn().mockResolvedValue({}) } as any, { orgId: 'test-org', userId: 'test-user', requestId: 'test-request' } as any, { increment: jest.fn() } as any, { enforceMeter: jest.fn().mockResolvedValue({ allowed: true }) } as any)

    await svc.processPersistedInboundWebhook({ webhookEventId: 'wh1', orgId: 'org1', provider: 'meta_cloud', traceId: 'trace-1' })
    event.status = 'PROCESSED'
    await svc.processPersistedInboundWebhook({ webhookEventId: 'wh1', orgId: 'org1', provider: 'meta_cloud', traceId: 'trace-1' })

    expect(prisma.whatsAppMessage.create).toHaveBeenCalledTimes(1)
    expect(prisma.whatsAppWebhookEvent.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'wh1' }, data: expect.objectContaining({ status: 'PROCESSED' }) }))
  })

  it('dead-letter marca webhook FAILED com tentativas e erro visíveis', async () => {
    const prisma: any = {
      whatsAppWebhookEvent: { update: jest.fn().mockResolvedValue({ id: 'wh1', status: 'FAILED' }) },
    }
    const svc = new WhatsAppService(prisma, { addJob: jest.fn() } as any, {} as any, { log: jest.fn() } as any, { orgId: 'test-org', userId: 'test-user', requestId: 'test-request' } as any, { increment: jest.fn() } as any, { enforceMeter: jest.fn().mockResolvedValue({ allowed: true }) } as any)

    await svc.deadLetterWebhookEvent({ id: 'wh1', orgId: 'org1', errorMessage: 'boom', attemptsMade: 5 })

    expect(prisma.whatsAppWebhookEvent.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'wh1' },
      data: expect.objectContaining({ status: 'FAILED', orgId: 'org1', retryAttempts: 5, errorMessage: expect.stringContaining('boom') }),
    }))
  })

})
