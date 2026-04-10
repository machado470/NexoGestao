import { BadRequestException } from '@nestjs/common'
import { FinanceService } from './finance.service'

describe('FinanceService hardening', () => {
  const buildService = () => {
    const prisma = {
      customer: { findFirst: jest.fn() },
      serviceOrder: { findFirst: jest.fn() },
      charge: {
        create: jest.fn(),
        findFirst: jest.fn(),
      },
      payment: { findFirst: jest.fn() },
      $transaction: jest.fn(),
    } as any

    const whatsapp = {} as any
    const timeline = { log: jest.fn().mockResolvedValue(undefined) } as any
    const analytics = { track: jest.fn() } as any
    const requestContext = { requestId: 'req-1' } as any
    const idempotency = {
      begin: jest.fn(),
      complete: jest.fn(),
      fail: jest.fn(),
    } as any
    const metrics = { increment: jest.fn() } as any

    const service = new FinanceService(
      prisma,
      whatsapp,
      timeline,
      analytics,
      requestContext,
      idempotency,
      metrics,
    )

    return { service, prisma, idempotency, metrics }
  }

  it('bloqueia geração de cobrança para O.S. cancelada', async () => {
    const { service, prisma, idempotency } = buildService()
    idempotency.begin.mockResolvedValue({ mode: 'execute', recordId: 'idem-1' })
    prisma.serviceOrder.findFirst.mockResolvedValue({
      id: 'os-1',
      customerId: 'c-1',
      status: 'CANCELED',
    })

    await expect(
      service.ensureChargeForServiceOrderDone({
        orgId: 'org-1',
        serviceOrderId: 'os-1',
        customerId: 'c-1',
        amountCents: 1000,
      }),
    ).rejects.toThrow('O.S. cancelada')
  })

  it('bloqueia pagamento em cobrança cancelada', async () => {
    const { service, prisma, idempotency } = buildService()
    idempotency.begin.mockResolvedValue({ mode: 'execute', recordId: 'idem-1' })

    prisma.$transaction.mockImplementation(async (cb: any) =>
      cb({
        charge: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'ch-1',
            orgId: 'org-1',
            status: 'CANCELED',
          }),
          updateMany: jest.fn(),
        },
        payment: { findFirst: jest.fn() },
      }),
    )

    await expect(
      service.payCharge({
        orgId: 'org-1',
        chargeId: 'ch-1',
        amountCents: 1000,
        method: 'PIX',
      }),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('bloqueia pagamento quando cobrança já está paga', async () => {
    const { service, prisma, idempotency } = buildService()
    idempotency.begin.mockResolvedValue({ mode: 'execute', recordId: 'idem-1' })

    prisma.$transaction.mockImplementation(async (cb: any) =>
      cb({
        charge: {
          findFirst: jest
            .fn()
            .mockResolvedValueOnce({ id: 'ch-1', orgId: 'org-1', status: 'PAID' })
            .mockResolvedValueOnce({ id: 'ch-1', orgId: 'org-1', status: 'PAID' }),
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
        payment: { findFirst: jest.fn().mockResolvedValue(null) },
      }),
    )

    await expect(
      service.payCharge({
        orgId: 'org-1',
        chargeId: 'ch-1',
        amountCents: 1000,
        method: 'PIX',
      }),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('retorna modo degradado quando envio de WhatsApp falha ao criar cobrança', async () => {
    const { service, prisma, idempotency, metrics } = buildService()
    idempotency.begin.mockResolvedValue({ mode: 'execute', recordId: 'idem-1' })
    prisma.customer.findFirst.mockResolvedValue({ id: 'c-1' })
    prisma.charge.create.mockResolvedValue({
      id: 'ch-1',
      orgId: 'org-1',
      customerId: 'c-1',
      serviceOrderId: null,
      amountCents: 1000,
      dueDate: new Date('2026-01-01T00:00:00Z'),
      customer: { id: 'c-1', name: 'Cliente', phone: '+5511999999999' },
    })

    jest.spyOn(service, 'sendChargeWhatsApp').mockRejectedValue(new Error('timeout'))

    const result = await service.createCharge({
      orgId: 'org-1',
      customerId: 'c-1',
      amountCents: 1000,
      dueDate: new Date('2026-01-01T00:00:00Z'),
    })

    expect(result.degraded).toEqual({
      channel: 'whatsapp',
      reason: 'whatsapp_send_failed',
      fallback: 'message_queued',
      status: 'retry_scheduled',
    })
    expect(result.operation?.status).toBe('executed')
    expect(metrics.increment).toHaveBeenCalledWith('integrationTemporaryFailures')
  })

  it('retorna duplicate quando idempotência replaya createCharge', async () => {
    const { service, idempotency, prisma } = buildService()
    prisma.customer.findFirst.mockResolvedValue({ id: 'c-1' })
    idempotency.begin.mockResolvedValue({
      mode: 'replay',
      recordId: 'idem-1',
      response: { id: 'ch-1', idempotent: true },
    })

    const result = await service.createCharge({
      orgId: 'org-1',
      customerId: 'c-1',
      amountCents: 1000,
      dueDate: new Date('2026-01-01T00:00:00Z'),
      idempotencyKey: 'k-charge-1',
    })

    expect(result.id).toBe('ch-1')
    expect(result.operation).toEqual({
      status: 'duplicate',
      reason: 'idempotency_replay',
      idempotencyKey: 'k-charge-1',
    })
  })

  it('retorna duplicate quando idempotência replaya payCharge', async () => {
    const { service, idempotency } = buildService()
    idempotency.begin.mockResolvedValue({
      mode: 'replay',
      recordId: 'idem-1',
      response: { ok: true, paymentId: 'pay-1', idempotent: true },
    })

    const result = await service.payCharge({
      orgId: 'org-1',
      chargeId: 'ch-1',
      amountCents: 1000,
      method: 'PIX',
      idempotencyKey: 'k-pay-1',
    })

    expect(result.paymentId).toBe('pay-1')
    expect(result.operation).toEqual({
      status: 'duplicate',
      reason: 'idempotency_replay',
      idempotencyKey: 'k-pay-1',
    })
  })
})
