import { BadRequestException } from '@nestjs/common'
import { ExpensesService } from './expenses.service'

describe('Monthly financial reporting uses the organization calendar', () => {
  let service: ExpensesService
  const org = { findUnique: jest.fn() }
  const expense = { findMany: jest.fn() }
  const payment = { aggregate: jest.fn() }
  const charge = { aggregate: jest.fn() }
  const timeline = { log: jest.fn() }
  beforeEach(() => {
    jest.resetAllMocks()
    org.findUnique.mockResolvedValue({ timezone: 'America/Sao_Paulo' })
    expense.findMany.mockResolvedValue([])
    payment.aggregate.mockResolvedValue({ _sum: { amountCents: 0 } })
    charge.aggregate.mockResolvedValue({ _sum: { amountCents: 0 } })
    service = new ExpensesService({ organization: org, expense, payment, charge, $queryRaw:jest.fn().mockResolvedValue([{amountCents:0n}]), paymentRefund:{aggregate:jest.fn().mockResolvedValue({_sum:{amountCents:0}})} } as any, timeline as any)
  })
  afterEach(() => jest.restoreAllMocks())
  it('uses the same tenant month for expenses and received payments, with exclusive upper bounds', async () => {
    const start = new Date('2026-11-01T03:00:00Z'), end = new Date('2026-12-01T03:00:00Z')
    const rows = ['2026-11-01T02:59:59.999Z', start.toISOString(), '2026-12-01T02:59:59.999Z', end.toISOString()].map((time, i) => ({ time: new Date(time), amount: (i + 1) * 100 }))
    expense.findMany.mockImplementation(async ({ where }) => where.recurrence === 'MONTHLY' ? [] : rows.filter(row => row.time >= where.occurredAt.gte && row.time < where.occurredAt.lt).map(row => ({ amountCents: row.amount, type: 'VARIABLE', category: 'OTHER' })))
    payment.aggregate.mockImplementation(async ({ where }) => ({ _sum: { amountCents: rows.filter(row => row.time >= where.paidAt.gte && row.time < where.paidAt.lt).reduce((sum, row) => sum + row.amount * 10, 0) } }))
    expect(await service.getMonthlyFinancialResult('org', '2026-11')).toMatchObject({ month: '2026-11', totalRevenueMonth: 5000, totalExpensesMonth: 500, netMonthlyResult: 4500 })
    expect(expense.findMany).toHaveBeenCalledWith({ where: { orgId: 'org', recurrence: 'NONE', occurredAt: { gte: start, lt: end } } })
    expect(payment.aggregate).toHaveBeenCalledWith({ where: { orgId: 'org', paidAt: { gte: start, lt: end } }, _sum: { amountCents: true } })
    expect(org.findUnique).toHaveBeenCalledTimes(1)
    expect(timeline.log).not.toHaveBeenCalled()
  })
  it('chooses the default month in the organization, not UTC', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-12-01T01:00:00Z'))
    expect(await service.summary('org')).toMatchObject({ month: '2026-11' })
  })
  it.each(['2026-00', '2026-13', '2026-1', '0000-01', '', '2026-11-01', 'invalid'])('rejects malformed month %p before financial queries', async month => {
    await expect(service.summary('org', month)).rejects.toBeInstanceOf(BadRequestException)
    expect(expense.findMany).not.toHaveBeenCalled()
  })
  it.each([null, { timezone: null }, { timezone: 'Invalid/Zone' }])('fails explicitly for unavailable timezone %p', async organization => {
    org.findUnique.mockResolvedValue(organization)
    await expect(service.getMonthlyFinancialResult('org', '2026-11')).rejects.toBeInstanceOf(BadRequestException)
    expect(expense.findMany).not.toHaveBeenCalled()
    expect(payment.aggregate).not.toHaveBeenCalled()
  })
})
