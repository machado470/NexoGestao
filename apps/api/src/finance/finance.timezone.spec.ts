import { FinanceService } from './finance.service'

describe('Organization-local financial due dates', () => {
  let db: any, whatsapp: any, service: FinanceService
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-10T01:30:00Z'))
    db = {
      organization: { findUnique: jest.fn().mockResolvedValue({ timezone: 'America/Sao_Paulo' }) },
      charge: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn(), findUnique: jest.fn() },
    }
    whatsapp = { enqueueMessage: jest.fn().mockResolvedValue({ created: true, message: { id: 'message' } }) }
    service = new FinanceService(db, whatsapp, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any)
  })
  afterEach(() => { jest.useRealTimers() })
  it('uses the tenant date for both due-today reminders and overdue candidates', async () => {
    await service.automateOverdueLifecycle('org')
    expect(db.organization.findUnique).toHaveBeenCalledWith({ where: { id: 'org' }, select: { timezone: true } })
    expect(db.charge.findMany).toHaveBeenNthCalledWith(1, { where: { orgId: 'org', status: 'PENDING', dueDate: { gte: new Date('2026-11-09T03:00Z'), lt: new Date('2026-11-10T03:00Z') } } })
    expect(db.charge.findMany).toHaveBeenNthCalledWith(2, { where: { orgId: 'org', status: 'PENDING', dueDate: { lt: new Date('2026-11-09T03:00Z') } } })
  })
  it('fails before financial work if the organization timezone is invalid', async () => {
    db.organization.findUnique.mockResolvedValue({ timezone: 'Mars/Olympus' })
    await expect(service.automateOverdueLifecycle('org')).rejects.toThrow('Fuso horário')
    expect(db.charge.findMany).not.toHaveBeenCalled()
  })
  it('does not process an unknown tenant', async () => {
    db.organization.findUnique.mockResolvedValue(null)
    await expect(service.automateOverdueLifecycle('unknown')).rejects.toThrow('Organização não encontrada')
    expect(db.charge.findMany).not.toHaveBeenCalled()
  })
  it.each(['charge', 'reminder'])('formats the %s message date in the tenant timezone', async kind => {
    db.charge.findUnique.mockResolvedValue({ id: 'charge', orgId: 'org', org: { timezone: 'America/Sao_Paulo' }, status: 'PENDING', amountCents: 1000, customerId: 'customer', dueDate: new Date('2026-11-10T01:00Z'), customer: { name: 'Customer', phone: '5511999999999' } })
    if (kind === 'charge') await service.sendChargeWhatsApp('charge')
    else await service.sendPaymentReminderWhatsApp('charge')
    expect(whatsapp.enqueueMessage).toHaveBeenCalledWith(expect.objectContaining({ renderedText: expect.stringContaining('09/11/2026') }))
  })
})
