import { WhatsAppService } from './whatsapp.service'
import { TenantOperationsService } from '../common/tenant-ops/tenant-ops.service'

describe('WhatsAppService prioridade e nextAction', () => {
  it('classifica como CRITICAL com cobrança vencida sem resposta e sugere cobrança', async () => {
    const now = new Date('2026-04-29T10:00:00Z')
    const prisma: any = {
      whatsAppConversation: { findMany: jest.fn().mockResolvedValue([{ id: 'conv1', orgId: 'org1', customerId: 'c1', status: 'WAITING_CUSTOMER', priority: 'NORMAL', unreadCount: 1, contextType: 'CUSTOMER', updatedAt: now, lastMessageAt: now, lastInboundAt: new Date('2026-04-29T08:00:00Z'), lastOutboundAt: new Date('2026-04-29T07:00:00Z') }]) },
      whatsAppMessage: { groupBy: jest.fn().mockResolvedValue([]) },
      charge: { groupBy: jest.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([{ customerId: 'c1', _count: { _all: 1 } }]) },
      appointment: { groupBy: jest.fn().mockResolvedValue([]) },
      serviceOrder: { groupBy: jest.fn().mockResolvedValue([]) },
    }
    const svc = new WhatsAppService(prisma, { addJob: jest.fn() } as any, { log: jest.fn() } as any, {} as any, new TenantOperationsService(), { enforceMeter: jest.fn().mockResolvedValue({ allowed: true }) } as any)
    const res = await svc.listConversations('org1', {})
    expect(res.items[0].priority).toBe('CRITICAL')
    expect(res.items[0].nextAction).toBe('SEND_PAYMENT_REMINDER')
  })
})
