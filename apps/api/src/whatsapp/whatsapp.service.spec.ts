import { WhatsAppService } from './whatsapp.service'
import { TenantOperationsService } from '../common/tenant-ops/tenant-ops.service'

describe('WhatsAppService queue hardening', () => {
  it('enfileira job com jobId determinístico para deduplicação', async () => {
    const prisma = {
      customer: {
        findFirst: jest.fn().mockResolvedValue({ id: 'c-1' }),
      },
      serviceOrder: {
        findFirst: jest.fn().mockResolvedValue({ id: 'os-1' }),
      },
      whatsAppMessage: {
        create: jest.fn().mockResolvedValue({
          id: 'msg-1',
          orgId: 'org-1',
          customerId: 'c-1',
          messageKey: 'k1',
        }),
      },
    } as any

    const queueService = {
      addJob: jest.fn().mockResolvedValue({ id: 'job-1' }),
    } as any

    const timeline = { log: jest.fn() } as any
    const requestContext = { requestId: 'req-1' } as any
    const tenantOps = new TenantOperationsService()
    const commercial = {
      enforceMeter: jest.fn().mockResolvedValue({ allowed: true }),
    } as any

    const service = new WhatsAppService(
      prisma,
      queueService,
      timeline,
      requestContext,
      tenantOps,
      commercial,
    )

    await service.enqueueMessage({
      orgId: 'org-1',
      customerId: 'c-1',
      toPhone: '+5511999999999',
      entityType: 'SERVICE_ORDER',
      entityId: 'os-1',
      messageType: 'EXECUTION_CONFIRMATION',
      messageKey: 'k1',
      renderedText: 'teste',
    })

    expect(queueService.addJob).toHaveBeenCalledWith(
      'whatsapp',
      'dispatch-message',
      { messageId: 'msg-1' },
      { jobId: 'whatsapp:dispatch:msg-1' },
    )
  })

  it('bloqueia quando customerId não pertence ao tenant', async () => {
    const prisma = {
      customer: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    } as any

    const service = new WhatsAppService(
      prisma,
      { addJob: jest.fn() } as any,
      { log: jest.fn() } as any,
      { requestId: 'req-2' } as any,
      new TenantOperationsService(),
      { enforceMeter: jest.fn().mockResolvedValue({ allowed: true }) } as any,
    )

    await expect(
      service.queueMessage({
        orgId: 'org-1',
        customerId: 'c-other-org',
        toPhone: '+5511999999999',
        entityType: 'SERVICE_ORDER',
        entityId: 'os-1',
        messageType: 'EXECUTION_CONFIRMATION',
        messageKey: 'cross-tenant',
        renderedText: 'teste',
      }),
    ).rejects.toThrow('customerId não pertence ao tenant informado')
  })
})
