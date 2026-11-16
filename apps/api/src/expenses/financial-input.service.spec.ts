import { BadRequestException } from '@nestjs/common'
import { ExpensesService } from './expenses.service'
import { LaunchesService } from '../launches/launches.service'

describe('Financial cents remain validated for internal callers', () => {
  const record = { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() }
  const prisma = { expense: record, launch: record }
  const timeline = { log: jest.fn() }
  const expenses = new ExpensesService(prisma as any, timeline as any)
  const launches = new LaunchesService(prisma as any)
  beforeEach(() => {
    jest.clearAllMocks()
    record.findFirst.mockResolvedValue({ id: 'record' })
  })
  it.each([0, -1, 1.5, 2_147_483_648, NaN, Infinity, '100'])('rejects invalid cents %p before writing through either service', async amountCents => {
    const expense = { title: 'Despesa', amountCents, category: 'OTHER', type: 'VARIABLE', occurredAt: '2026-11-01' } as any
    const launch = { description: 'Receita', amountCents, category: 'Serviços', type: 'INCOME', date: '2026-11-01' } as any
    await expect(expenses.create('org', 'actor', expense)).rejects.toBeInstanceOf(BadRequestException)
    await expect(expenses.update('org', 'record', 'actor', { amountCents } as any)).rejects.toBeInstanceOf(BadRequestException)
    await expect(launches.create('org', 'actor', launch)).rejects.toBeInstanceOf(BadRequestException)
    await expect(launches.update('org', 'record', { amountCents } as any)).rejects.toBeInstanceOf(BadRequestException)
    expect(record.create).not.toHaveBeenCalled(); expect(record.update).not.toHaveBeenCalled()
    expect(timeline.log).not.toHaveBeenCalled()
  })
})
