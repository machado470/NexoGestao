import { WhatsAppService } from './whatsapp.service'

describe('WhatsAppService queue hardening', () => {
  it('enfileira job com jobId determinístico para deduplicação', async () => {
    const prisma = {
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

    const service = new WhatsAppService(prisma, queueService, timeline, requestContext)

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
})
