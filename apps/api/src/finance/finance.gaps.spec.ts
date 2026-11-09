import { FinanceService } from './finance.service'
import { CustomersService } from '../customers/customers.service'

describe('Financial gap regressions', () => {
  const stamp = new Date('2026-11-09T12:00:00Z')
  const build = (status = 'PENDING') => {
    const db: any = { charge: { findFirst: jest.fn().mockResolvedValue({ id: 'charge', orgId: 'org', status, amountCents: 1000, dueDate: stamp, updatedAt: stamp }), updateMany: jest.fn().mockResolvedValue({ count: 1 }), findMany: jest.fn() }, $transaction: jest.fn() }
    const timeline: any = { log: jest.fn(), logInTransaction: jest.fn().mockResolvedValue({ id: 'event' }), dispatchPersistedEventWebhook: jest.fn() }
    const service = new FinanceService(db, {} as any, timeline, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any)
    db.$transaction.mockImplementation((fn: any) => fn(db))
    return { db, timeline, service }
  }
  it.each(['PAID', 'CANCELED'])('rejects monetary or due-date changes for %s charges', async status => {
    const { db, service } = build(status)
    await expect(service.updateCharge({ id: 'charge', orgId: 'org', amountCents: 2000, expectedUpdatedAt: stamp.toISOString() })).rejects.toThrow('não pode ser alterado')
    await expect(service.updateCharge({ id: 'charge', orgId: 'org', dueDate: new Date('2027-01-01'), expectedUpdatedAt: stamp.toISOString() })).rejects.toThrow('vencimento')
    expect(db.charge.updateMany).not.toHaveBeenCalled()
  })
  it.each(['PAID', 'CANCELED'])('preserves an unchanged %s charge while clearing notes', async status => {
    const { db, service } = build(status)
    await service.updateCharge({ id: 'charge', orgId: 'org', amountCents: 1000, dueDate: stamp, notes: '', expectedUpdatedAt: stamp.toISOString() })
    expect(db.charge.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ notes: '' }) }))
  })
  it('does not emit an overdue transition when a competing mutation won', async () => {
    const { db, timeline, service } = build()
    const candidate = { id: 'charge', amountCents: 1000, dueDate: stamp, updatedAt: stamp }
    db.charge.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([candidate]).mockResolvedValueOnce([])
    db.charge.updateMany.mockResolvedValue({ count: 0 })
    expect(await service.automateOverdueLifecycle('org')).toEqual({ ok: true, updated: 0 })
    expect(timeline.logInTransaction).not.toHaveBeenCalled()
    expect(timeline.dispatchPersistedEventWebhook).not.toHaveBeenCalled()
  })
  it('persists one transition atomically and dispatches only after commit', async () => {
    const { db, timeline, service } = build()
    let committed = false
    db.charge.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: 'charge', amountCents: 1000, dueDate: stamp, updatedAt: stamp }]).mockResolvedValueOnce([])
    db.$transaction.mockImplementation(async (fn: any) => { const result = await fn(db); committed = true; return result })
    timeline.dispatchPersistedEventWebhook.mockImplementation(() => { expect(committed).toBe(true) })
    expect(await service.automateOverdueLifecycle('org')).toEqual({ ok: true, updated: 1 })
    expect(timeline.logInTransaction).toHaveBeenCalledWith(expect.objectContaining({ action: 'CHARGE_OVERDUE' }), db)
  })
  it('uses safe CSV quoting in customer and charge exports', async () => {
    const { db, service } = build()
    db.charge.findMany.mockResolvedValue([{ id: 'charge', amountCents: 1000, customer: { name: '=1+1' }, dueDate: stamp, createdAt: stamp, status: 'PENDING' }])
    expect(await service.exportChargesCsv('org')).toContain('"\'=1+1"')
    const customers = new CustomersService({ customer: { findMany: async () => [{ id: 'c', name: 'Cliente "VIP", Sul', email: '+FORMULA', phone: '5511', active: true, createdAt: stamp }] } } as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any)
    const result = await customers.exportCsv('org')
    expect(result).toContain('"Cliente ""VIP"", Sul"')
    expect(result).toContain('"\'+FORMULA"')
  })
})
