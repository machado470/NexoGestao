import { WhatsAppService } from './whatsapp.service'
import { TenantOperationsService } from '../common/tenant-ops/tenant-ops.service'
import { normalizePhone } from './phone.util'

jest.mock('./providers/provider.factory', () => ({
  createWhatsAppProvider: () => ({
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
    const svc = new WhatsAppService(prisma, { addJob: jest.fn() } as any, { log: jest.fn().mockResolvedValue({}) } as any, {} as any, new TenantOperationsService(), { enforceMeter: jest.fn().mockResolvedValue({ allowed: true }) } as any)
    await svc.processInboundWebhook('meta_cloud', {})
    await svc.processInboundWebhook('meta_cloud', {})
    expect(prisma.whatsAppMessage.create).toHaveBeenCalledTimes(1)
    expect(prisma.whatsAppConversation.updateMany).toHaveBeenCalled()
  })

  it('inbound sem cliente retorna erro controlado', async () => {
    const prisma: any = {
      customer: { findFirst: jest.fn().mockResolvedValue(null) },
      whatsAppMessage: { findFirst: jest.fn(), count: jest.fn().mockResolvedValue(0) },
      timelineEvent: { findFirst: jest.fn().mockResolvedValue(null) },
    }
    const svc = new WhatsAppService(prisma, { addJob: jest.fn() } as any, { log: jest.fn().mockResolvedValue({}) } as any, {} as any, new TenantOperationsService(), { enforceMeter: jest.fn().mockResolvedValue({ allowed: true }) } as any)
    const result = await svc.processInboundWebhook('meta_cloud', {})
    expect(result.results[0].reason).toBe('customer_not_found')
  })

  it('outbound enfileira envio async', async () => {
    const addJob = jest.fn().mockResolvedValue({ id: 'j1' })
    const prisma: any = {
      customer: { findFirst: jest.fn().mockResolvedValue({ id: 'c1', phone: '+5511999999999' }) },
      whatsAppConversation: { findFirst: jest.fn().mockResolvedValue({ id: 'conv1', customerId: 'c1', phone: '+5511999999999' }), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      whatsAppMessage: { create: jest.fn().mockResolvedValue({ id: 'm1', createdAt: new Date(), customerId: 'c1', conversationId: 'conv1', status: 'QUEUED' }) },
    }
    const svc = new WhatsAppService(prisma, { addJob } as any, { log: jest.fn().mockResolvedValue({}) } as any, {} as any, new TenantOperationsService(), { enforceMeter: jest.fn().mockResolvedValue({ allowed: true }) } as any)
    await svc.enqueueMessage('org1', { customerId: 'c1', content: 'oi', entityType: 'CUSTOMER', entityId: 'c1', messageType: 'MANUAL' })
    expect(addJob).toHaveBeenCalled()
  })
})
