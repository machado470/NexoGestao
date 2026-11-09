import { ExpensesService } from './expenses.service'

describe('Expense summary read semantics', () => {
  it('returns recurring totals without recording an application event on reads', async () => {
    const timeline = { log: jest.fn().mockRejectedValue(new Error('not reachable on reads')) }
    const service = new ExpensesService({ expense: { findMany: async (q: any) => q.where.recurrence === 'MONTHLY' ? [{ amountCents: 1500, category: 'OTHER', type: 'FIXED' }] : [] } } as any, timeline as any)
    expect(await service.summary('org', '2026-11')).toMatchObject({ totalExpenses: 1500, recurringAppliedCount: 1 })
    expect(await service.summary('org', '2026-11')).toMatchObject({ totalExpenses: 1500, recurringAppliedCount: 1 })
    expect(timeline.log).not.toHaveBeenCalled()
  })
})
