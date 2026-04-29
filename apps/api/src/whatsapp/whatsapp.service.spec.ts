import { WhatsAppService } from './whatsapp.service'
import { TenantOperationsService } from '../common/tenant-ops/tenant-ops.service'

jest.mock('./providers/provider.factory', () => ({
  createWhatsAppProvider: () => ({
    parseWebhook: jest.fn(() => [{
      eventType: 'MESSAGE_RECEIVED',
      fromPhone: '5511999999999',
      toPhone: '5511888888888',
      content: 'oi',
      providerMessageId: 'wamid.1',
      timestamp: new Date('2026-01-01T00:00:00Z'),
      metadata: {},
    }]),
  }),
}))

describe('WhatsAppService inbound/outbound', () => {
  it('inbound cria mensagem e não duplica webhook repetido', async () => {
    const prisma: any = {
      customer: { findFirst: jest.fn().mockResolvedValue({ id: 'c1', orgId: 'org1', phone: '5511999999999' }) },
      whatsAppConversation: {
        findFirst: jest.fn().mockResolvedValue({ id: 'conv1', customerId: 'c1', phone: '5511999999999' }),
        update: jest.fn().mockResolvedValue({}),
      },
      whatsAppMessage: {
        findFirst: jest.fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ id: 'm1', orgId: 'org1', providerMessageId: 'wamid.1' }),
        create: jest.fn().mockResolvedValue({ id: 'm1', createdAt: new Date(), entityType: 'CUSTOMER', entityId: 'c1', messageType: 'MANUAL', status: 'DELIVERED' }),
      },
      timelineEvent: { findFirst: jest.fn().mockResolvedValue(null) },
    }
    const svc = new WhatsAppService(prisma, { addJob: jest.fn() } as any, { log: jest.fn().mockResolvedValue({}) } as any, {} as any, new TenantOperationsService(), { enforceMeter: jest.fn().mockResolvedValue({ allowed: true }) } as any)
    await svc.processInboundWebhook('meta_cloud', {})
    await svc.processInboundWebhook('meta_cloud', {})
    expect(prisma.whatsAppMessage.create).toHaveBeenCalledTimes(1)
    expect(prisma.whatsAppConversation.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'WAITING_OPERATOR' }) }))
  })
})
