import { FinanceService } from './finance.service'

describe('finance currency metadata', () => {
  it('reports persisted currencies, isolated by tenant, instead of the company preference', async () => {
    const prisma = { charge: { aggregate: jest.fn().mockResolvedValue({ _count: { _all: 1 }, _sum: { amountCents: 100 } }), findMany: jest.fn().mockResolvedValue([{ currency: 'BRL' }, { currency: 'USD' }]) }, $queryRaw: jest.fn().mockResolvedValue([{ amountCents: 0n }]) }
    const service = new FinanceService(prisma as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any)
    const result = await service.getChargeStats('authenticated-org')
    expect(result.currencies).toEqual(['BRL', 'USD'])
    expect(prisma.charge.findMany).toHaveBeenCalledWith({ where: { orgId: 'authenticated-org' }, select: { currency: true }, distinct: ['currency'] })
    for (const [input] of prisma.charge.aggregate.mock.calls) expect(input.where.orgId).toBe('authenticated-org')
  })
})
