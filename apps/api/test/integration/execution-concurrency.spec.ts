import { ExecutionService } from '../../src/execution/execution.service'

describe('ExecutionService concurrency hardening', () => {
  it('creates charge/timeline only once when completing the same execution in parallel', async () => {
    const state = {
      serviceOrder: {
        id: 'exec-1',
        orgId: 'org-1',
        customerId: 'cust-1',
        assignedToPersonId: 'person-1',
        status: 'IN_PROGRESS',
        startedAt: new Date('2026-01-01T10:00:00.000Z'),
        finishedAt: null as Date | null,
        description: 'desc',
        outcomeSummary: null as string | null,
        amountCents: 1000,
        dueDate: new Date('2026-01-10T00:00:00.000Z'),
        createdAt: new Date('2026-01-01T09:00:00.000Z'),
        updatedAt: new Date('2026-01-01T09:00:00.000Z'),
      },
    }

    const prisma = {
      serviceOrder: {
        findFirst: jest.fn(async ({ where }: any) => {
          if (where.id !== state.serviceOrder.id || where.orgId !== state.serviceOrder.orgId) {
            return null
          }
          return { ...state.serviceOrder }
        }),
        updateMany: jest.fn(async ({ where, data }: any) => {
          await new Promise((r) => setTimeout(r, 5))
          if (
            where.id === state.serviceOrder.id &&
            where.orgId === state.serviceOrder.orgId &&
            state.serviceOrder.status !== 'DONE'
          ) {
            state.serviceOrder = {
              ...state.serviceOrder,
              ...data,
              status: 'DONE',
              finishedAt: data.finishedAt,
            }
            return { count: 1 }
          }
          return { count: 0 }
        }),
      },
    }

    const timeline = { log: jest.fn(async () => ({})) }
    const audit = { log: jest.fn(async () => ({})) }
    const requestContext = { requestId: 'req-1', userId: 'user-1' }
    const metrics = { increment: jest.fn() }
    const finance = {
      ensureChargeForServiceOrderDone: jest.fn(async () => ({ created: true, chargeId: 'chg-1' })),
    }

    const service = new ExecutionService(
      prisma as any,
      timeline as any,
      audit as any,
      requestContext as any,
      metrics as any,
      finance as any,
    )

    const [first, second] = await Promise.all([
      service.complete({ orgId: 'org-1', executionId: 'exec-1' }),
      service.complete({ orgId: 'org-1', executionId: 'exec-1' }),
    ])

    expect([first, second].filter((r: any) => r.idempotent).length).toBe(1)
    expect(timeline.log).toHaveBeenCalledTimes(1)
    expect(audit.log).toHaveBeenCalledTimes(1)
    expect(finance.ensureChargeForServiceOrderDone).toHaveBeenCalledTimes(1)
    expect(metrics.increment).toHaveBeenCalledTimes(1)
  })
})
