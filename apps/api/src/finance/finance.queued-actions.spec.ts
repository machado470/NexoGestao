import { FinanceService } from './finance.service'

describe('Queued financial actions', () => {
  let db: any, whatsapp: any, service: FinanceService
  beforeEach(() => {
    db = { charge: { findFirst: jest.fn().mockResolvedValue({ id: 'charge', orgId: 'org', org: { timezone: 'America/Sao_Paulo' }, status: 'PENDING', customerId: 'customer', amountCents: 1000, dueDate: new Date(), customer: { name: 'Customer', phone: '5511999999999' } }) } }
    whatsapp = { enqueueMessage: jest.fn().mockResolvedValue({ created: true, message: { id: 'm1' } }) }
    service = new FinanceService(db, whatsapp, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any)
  })
  it('does not simulate successful automatic charge creation', async () => {
    await expect(service.createAutomationCharge({ orgId: 'org' })).rejects.toThrow('indisponível')
  })
  it.each([{}, { orgId: 'org' }, { orgId: 1, chargeId: 'charge' }, { orgId: 'org', chargeId: ' ' }])('rejects malformed reminder payload %p', async input => {
    await expect(service.sendPaymentReminder(input)).rejects.toThrow('orgId e chargeId')
    expect(db.charge.findFirst).not.toHaveBeenCalled()
  })
  it('checks the charge within the trusted job tenant and confirms queue admission', async () => {
    await expect(service.sendPaymentReminder({ orgId: 'org', chargeId: 'charge' })).resolves.toEqual({ status: 'queued', messageId: 'm1' })
    expect(db.charge.findFirst).toHaveBeenCalledWith({ where: { id: 'charge', orgId: 'org' }, include: { customer: true, org: { select: { timezone: true } } } })
    expect(whatsapp.enqueueMessage).toHaveBeenCalledTimes(1)
  })
  it('rejects missing or foreign charges without sending WhatsApp', async () => {
    db.charge.findFirst.mockResolvedValue(null)
    await expect(service.sendPaymentReminder({ orgId: 'org', chargeId: 'foreign' })).rejects.toThrow('nesta organização')
    expect(whatsapp.enqueueMessage).not.toHaveBeenCalled()
  })
  it.each(['PAID', 'CANCELED'])('returns an explicit skipped result for %s', async status => {
    db.charge.findFirst.mockResolvedValue({ status })
    await expect(service.sendPaymentReminder({ orgId: 'org', chargeId: 'charge' })).resolves.toEqual({ status: 'skipped', reason: 'charge_closed' })
    expect(whatsapp.enqueueMessage).not.toHaveBeenCalled()
  })
  it('returns skipped when no destination phone exists', async () => {
    db.charge.findFirst.mockResolvedValue({ status: 'PENDING', customer: { phone: null } })
    await expect(service.sendPaymentReminder({ orgId: 'org', chargeId: 'charge' })).resolves.toEqual({ status: 'skipped', reason: 'missing_phone' })
  })
  it('reports a duplicate without implying a new message was queued', async () => {
    whatsapp.enqueueMessage.mockResolvedValue({ created: false, message: { id: 'm1' } })
    await expect(service.sendPaymentReminder({ orgId: 'org', chargeId: 'charge' })).resolves.toEqual({ status: 'duplicate', messageId: 'm1' })
  })
  it('does not claim success without a queue acknowledgement', async () => {
    whatsapp.enqueueMessage.mockResolvedValue({})
    await expect(service.sendPaymentReminder({ orgId: 'org', chargeId: 'charge' })).rejects.toThrow('confirmar o enfileiramento')
  })
})
