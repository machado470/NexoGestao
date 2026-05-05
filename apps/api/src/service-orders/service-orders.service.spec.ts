import { ServiceOrdersService } from './service-orders.service'

describe('ServiceOrdersService timeline hardening', () => {
  it('emite SERVICE_ORDER_COMPLETED ao concluir O.S.', async () => {
    const before = {
      id: 'so-1',
      orgId: 'org-1',
      customerId: 'c-1',
      status: 'IN_PROGRESS',
      updatedAt: new Date('2026-01-01T00:00:00Z'),
      amountCents: 0,
      assignedToPersonId: null,
      title: 'OS crítica',
    }
    const updated = {
      ...before,
      status: 'DONE',
      customer: { id: 'c-1', name: 'Cliente', phone: null },
      assignedTo: null,
    }
    const prisma: any = {
      serviceOrder: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(before),
      },
      $transaction: jest.fn(async (cb: any) =>
        cb({
          serviceOrder: {
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            findFirst: jest.fn().mockResolvedValue(updated),
          },
        }),
      ),
    }
    const timeline = { log: jest.fn().mockResolvedValue(undefined) }
    const audit = { log: jest.fn().mockResolvedValue(undefined) }
    const operationalState = { syncAndLogStateChange: jest.fn().mockResolvedValue(undefined) }
    const finance = { ensureChargeForServiceOrderDone: jest.fn() }
    const automation = { executeTrigger: jest.fn().mockResolvedValue(undefined) }
    const notifications = {} as any
    const onboarding = {} as any
    const whatsApp = { enqueueMessage: jest.fn() }
    const analytics = { track: jest.fn().mockResolvedValue(undefined) }
    const idempotency = {
      begin: jest.fn().mockResolvedValue({ mode: 'execute', recordId: 'idem-1' }),
      complete: jest.fn().mockResolvedValue(undefined),
      fail: jest.fn().mockResolvedValue(undefined),
    }

    const service = new ServiceOrdersService(
      prisma,
      timeline as any,
      audit as any,
      operationalState as any,
      finance as any,
      automation as any,
      notifications,
      onboarding,
      whatsApp as any,
      analytics as any,
      idempotency as any,
    )

    await service.update({
      orgId: 'org-1',
      updatedBy: 'u-1',
      personId: 'p-1',
      id: 'so-1',
      data: {
        status: 'DONE',
        expectedUpdatedAt: before.updatedAt.toISOString(),
      },
    })

    expect(timeline.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'SERVICE_ORDER_COMPLETED',
        serviceOrderId: 'so-1',
        customerId: 'c-1',
      }),
    )
  })
})
