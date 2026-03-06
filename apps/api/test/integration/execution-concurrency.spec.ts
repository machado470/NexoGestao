import { ExecutionService } from '../../src/execution/execution.service'

describe('ExecutionService concurrency hardening', () => {
  it('creates charge/timeline only once when completing the same execution in parallel', async () => {
    const state = {
      execution: {
        id: 'exec-1',
        orgId: 'org-1',
        serviceOrderId: 'so-1',
        customerId: 'cust-1',
        endedAt: null as Date | null,
      },
      timelineEvents: 0,
      chargesEnsured: 0,
    }

    const tx = {
      execution: {
        updateMany: jest.fn(async ({ where }: any) => {
          await new Promise((r) => setTimeout(r, 5))
          if (
            where.id === state.execution.id &&
            where.orgId === state.execution.orgId &&
            where.endedAt === null &&
            state.execution.endedAt === null
          ) {
            state.execution.endedAt = new Date()
            return { count: 1 }
          }

          return { count: 0 }
        }),
        findFirst: jest.fn(async ({ where }: any) => {
          if (where.id !== state.execution.id || where.orgId !== state.execution.orgId) {
            return null
          }

          return { ...state.execution }
        }),
      },
      serviceOrder: {
        updateMany: jest.fn(async () => ({ count: 1 })),
        findFirst: jest.fn(async () => ({ amountCents: 1000, dueDate: new Date('2026-01-01') })),
      },
      timelineEvent: {
        create: jest.fn(async () => {
          state.timelineEvents += 1
          return {}
        }),
      },
    }

    const prisma = {
      $transaction: jest.fn(async (cb: any) => cb(tx)),
    }

    const finance = {
      ensureChargeForServiceOrderDone: jest.fn(async () => {
        state.chargesEnsured += 1
        return { created: true, chargeId: 'chg-1' }
      }),
    }

    const timeline = { log: jest.fn() }

    const service = new ExecutionService(prisma as any, timeline as any, finance as any)

    const [first, second] = await Promise.all([
      service.complete({ orgId: 'org-1', executionId: 'exec-1' }),
      service.complete({ orgId: 'org-1', executionId: 'exec-1' }),
    ])

    expect([first, second].filter((r: any) => r.idempotent).length).toBe(1)
    expect(state.timelineEvents).toBe(1)
    expect(state.chargesEnsured).toBe(1)
    expect(finance.ensureChargeForServiceOrderDone).toHaveBeenCalledTimes(1)
  })
})
