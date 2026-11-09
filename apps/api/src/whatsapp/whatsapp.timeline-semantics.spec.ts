import { WhatsAppService } from './whatsapp.service'

describe('WhatsApp timeline semantics', () => {
  it('não registra MESSAGE_SENT enquanto a mensagem está apenas QUEUED', async () => {
    const timeline = {
      log: jest.fn().mockResolvedValue({}),
    }

    const service = new WhatsAppService(
      {} as any,
      {} as any,
      {} as any,
      timeline as any,
      {
        requestId: 'req-1',
        userId: 'user-1',
        orgId: 'org1',
      } as any,
      {} as any,
      {} as any,
    {} as any,
    )

    jest.spyOn(service, 'enqueueMessage').mockResolvedValue({
      created: true,
      message: {
        id: 'm1',
        orgId: 'org1',
        customerId: 'customer-1',
        conversationId: 'conversation-1',
        entityType: 'CUSTOMER',
        entityId: 'customer-1',
        messageType: 'MANUAL',
        status: 'QUEUED',
      },
    } as any)

    await service.sendManualMessage(
      'org1',
      'user-1',
      {
        customerId: 'customer-1',
        toPhone: '5511999999999',
        entityType: 'CUSTOMER',
        entityId: 'customer-1',
        messageType: 'MANUAL',
        content: 'Olá',
      },
    )

    expect(timeline.log).not.toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'WHATSAPP_MESSAGE_SENT',
      }),
    )

    expect(timeline.log).not.toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'MESSAGE_SENT',
      }),
    )
  })
})

describe('WhatsApp confirmed delivery events', () => {
  it.each([
    ['APPOINTMENT_CONFIRMATION', 'APPOINTMENT_CONFIRMATION_SENT'],
    ['PAYMENT_REMINDER', 'PAYMENT_REMINDER_SENT'],
    ['PAYMENT_CONFIRMATION', 'PAYMENT_CONFIRMATION_SENT'],
  ])('records %s only after provider confirmation, including callback confirmation', async (messageType, expectedAction) => {
    const message = { id: 'm1', orgId: 'org1', customerId: 'c1', status: 'SENT', messageType };
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([message]),
      whatsAppMessage: { findFirst: jest.fn().mockResolvedValue(message), update: jest.fn().mockResolvedValue(message), count: jest.fn().mockResolvedValue(0) },
      timelineEvent: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const timeline = { log: jest.fn().mockResolvedValue({}) };
    const service = new WhatsAppService(prisma as any, {} as any, {} as any, timeline as any, {} as any, {} as any, {} as any, {} as any);
    await service.markSent({ id: 'm1', orgId: 'org1', workerId: 'worker-1', provider: 'mock', providerMessageId: 'provider-1' });
    expect(timeline.log.mock.calls.map(([event]) => event.action)).toEqual(['MESSAGE_SENT', expectedAction]);
    timeline.log.mockClear();
    await service.updateMessageStatus('org1', { id: 'm1', status: 'SENT' });
    expect(timeline.log.mock.calls.map(([event]) => event.action)).toEqual(['MESSAGE_SENT', expectedAction]);
  });

  it('does not emit success when the worker no longer owns the sending message', async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([]) };
    const timeline = { log: jest.fn() };
    const service = new WhatsAppService(prisma as any, {} as any, {} as any, timeline as any, {} as any, {} as any, {} as any, {} as any);
    await expect(service.markSent({ id: 'm1', orgId: 'org1', workerId: 'stale-worker', provider: 'mock', providerMessageId: 'provider-1' })).resolves.toBeNull();
    expect(timeline.log).not.toHaveBeenCalled();
  });
});
