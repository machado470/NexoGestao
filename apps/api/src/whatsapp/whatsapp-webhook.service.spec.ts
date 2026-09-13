import { WhatsAppWebhookService } from './whatsapp-webhook.service'

describe('WhatsAppWebhookService tenant isolation', () => {
  it('resolve tenant somente pela conta Meta ativa persistida', async () => {
    const prisma = { whatsAppProviderAccount: { findMany: jest.fn().mockResolvedValue([{ orgId: 'tenant-a', accountId: 'phone-a' }]) } }
    const service = new WhatsAppWebhookService(prisma as any, {} as any, {} as any)
    const payload = { orgId: 'tenant-b', entry: [{ changes: [{ value: { metadata: { phone_number_id: 'phone-a' } } }] }] }

    await expect(service.resolveTenantFromProviderAccount('meta_cloud', payload)).resolves.toEqual({ orgId: 'tenant-a', accountIds: ['phone-a'] })
  })

  it('falha fechada quando contas do mesmo payload apontam para organizações diferentes', async () => {
    const prisma = { whatsAppProviderAccount: { findMany: jest.fn().mockResolvedValue([
      { orgId: 'tenant-a', accountId: 'phone-a' }, { orgId: 'tenant-b', accountId: 'phone-b' },
    ]) } }
    const service = new WhatsAppWebhookService(prisma as any, {} as any, {} as any)
    const payload = { entry: [
      { changes: [{ value: { metadata: { phone_number_id: 'phone-a' } } }] },
      { changes: [{ value: { metadata: { phone_number_id: 'phone-b' } } }] },
    ] }

    await expect(service.resolveTenantFromProviderAccount('meta_cloud', payload)).rejects.toThrow('ambígua')
  })

  it('não recupera nem reenfileira webhook pertencente a outro tenant', async () => {
    const prisma: any = {
      whatsAppWebhookEvent: { findMany: jest.fn().mockResolvedValue([]) },
    }
    const queue = { addJob: jest.fn() }
    const service = new WhatsAppWebhookService(prisma, queue as any, {} as any)

    await expect(service.replayWebhookEvents('tenant-a', { ids: ['webhook-tenant-b'] }))
      .rejects.toThrow('webhook WhatsApp não encontrado')

    expect(prisma.whatsAppWebhookEvent.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['webhook-tenant-b'] }, orgId: 'tenant-a' },
    })
    expect(queue.addJob).not.toHaveBeenCalled()
  })

  it('mantém lookup, recovery stats e processamento persistido limitados ao orgId', async () => {
    const prisma: any = {
      whatsAppWebhookEvent: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    }
    const service = new WhatsAppWebhookService(prisma, {} as any, {} as any)

    await expect(service.getWebhookEventDetail('tenant-a', 'webhook-tenant-b')).rejects.toThrow()
    await expect(service.processPersistedInboundWebhook(
      { webhookEventId: 'webhook-tenant-b', orgId: 'tenant-a', provider: 'meta_cloud' },
      jest.fn(),
    )).rejects.toThrow('webhook WhatsApp persistido não encontrado')

    expect(prisma.whatsAppWebhookEvent.findFirst).toHaveBeenNthCalledWith(1, {
      where: { id: 'webhook-tenant-b', orgId: 'tenant-a' },
    })
    expect(prisma.whatsAppWebhookEvent.findFirst).toHaveBeenNthCalledWith(2, {
      where: { id: 'webhook-tenant-b', orgId: 'tenant-a', provider: 'meta_cloud' },
    })
  })

  it('usa jobIds BullMQ determinísticos sem dois-pontos e distingue replay do enqueue inicial', async () => {
    const addJob = jest.fn()
      .mockResolvedValueOnce({ id: 'whatsapp-inbound-webhook-event-1' })
      .mockResolvedValueOnce({ id: 'whatsapp-inbound-webhook-event-1-replay-attempt-1' })
    const metrics = { incInboundWebhookQueued: jest.fn() }
    const service = new WhatsAppWebhookService({} as any, { addJob } as any, metrics as any)
    const input = {
      webhookEventId: 'event-1',
      orgId: 'tenant-a',
      provider: 'meta_cloud',
      traceId: 'trace-1',
      receivedAt: new Date('2026-09-13T00:00:00.000Z'),
    }

    await service.enqueueInboundWebhook(input)
    await service.enqueueInboundWebhook({ ...input, replayAttemptId: 'replay-attempt-1' })

    const initialJobId = addJob.mock.calls[0][3].jobId
    const replayJobId = addJob.mock.calls[1][3].jobId
    expect(initialJobId).toBe('whatsapp-inbound-webhook-event-1')
    expect(replayJobId).toBe('whatsapp-inbound-webhook-event-1-replay-attempt-1')
    expect(initialJobId).not.toContain(':')
    expect(replayJobId).not.toContain(':')
    expect(replayJobId).not.toBe(initialJobId)
  })
})
