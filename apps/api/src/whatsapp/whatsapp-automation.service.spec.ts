import { WhatsAppAutomationService } from './whatsapp-automation.service';

describe('WhatsApp automation delivery truth', () => {
  const customer = { id: 'customer-1', name: 'Ana', phone: '5511999999999' };
  const prisma = {
    appointment: { findFirst: jest.fn() }, serviceOrder: { findFirst: jest.fn() },
    charge: { findFirst: jest.fn() }, payment: { findFirst: jest.fn() },
  };
  const whatsapp = { enqueueMessage: jest.fn() };
  const timeline = { log: jest.fn().mockResolvedValue({}) };
  const service = new WhatsAppAutomationService(prisma as any, whatsapp as any, timeline as any);
  beforeEach(() => {
    jest.clearAllMocks();
    for (const model of [prisma.appointment, prisma.serviceOrder, prisma.charge]) model.findFirst.mockResolvedValue({ customer });
    prisma.payment.findFirst.mockResolvedValue({ charge: { customer } });
    whatsapp.enqueueMessage.mockResolvedValue({ created: true, message: { id: 'message-1', status: 'QUEUED' } });
  });
  it.each([
    ['sendAppointmentConfirmation', 'APPOINTMENT'], ['sendAppointmentReminder', 'APPOINTMENT'],
    ['sendPaymentReminder', 'CHARGE'], ['sendPaymentLink', 'CHARGE'],
    ['sendPaymentConfirmation', 'PAYMENT'], ['sendServiceUpdate', 'SERVICE_ORDER'],
  ] as const)('%s records queueing rather than confirmed delivery', async (method, entityType) => {
    await service[method]('org-1', 'entity-1');
    expect(whatsapp.enqueueMessage).toHaveBeenCalledWith('org-1', expect.objectContaining({ entityId: 'entity-1', entityType }));
    expect(timeline.log).toHaveBeenCalledTimes(1);
    expect(timeline.log).toHaveBeenCalledWith(expect.objectContaining({
      orgId: 'org-1', customerId: 'customer-1', action: 'WHATSAPP_MESSAGE_QUEUED',
      metadata: expect.objectContaining({ messageId: 'message-1', status: 'QUEUED', entityId: 'entity-1', entityType }),
    }));
  });
  it('does not duplicate history for an idempotent enqueue replay', async () => {
    whatsapp.enqueueMessage.mockResolvedValue({ created: false, message: { id: 'existing', status: 'SENT' } });
    await service.sendPaymentLink('org-1', 'charge-1');
    expect(timeline.log).not.toHaveBeenCalled();
  });
  it('does not send or log another tenant entity', async () => {
    prisma.charge.findFirst.mockResolvedValue(null);
    await expect(service.sendPaymentLink('org-1', 'foreign-charge')).resolves.toBeNull();
    expect(prisma.charge.findFirst).toHaveBeenCalledWith({ where: { orgId: 'org-1', id: 'foreign-charge' }, include: { customer: true } });
    expect(whatsapp.enqueueMessage).not.toHaveBeenCalled();
    expect(timeline.log).not.toHaveBeenCalled();
  });
  it('does not write queue history when enqueue fails', async () => {
    whatsapp.enqueueMessage.mockRejectedValueOnce(new Error('queue down'));
    await expect(service.sendPaymentLink('org-1', 'charge-1')).rejects.toThrow('queue down');
    expect(timeline.log).not.toHaveBeenCalled();
  });
});
