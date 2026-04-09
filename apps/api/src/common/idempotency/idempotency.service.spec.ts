import { BadRequestException, ConflictException } from '@nestjs/common'
import { IdempotencyService } from './idempotency.service'

describe('IdempotencyService', () => {
  const requestContext = { requestId: 'req-1' } as any
  const metrics = { increment: jest.fn() } as any

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('retorna replay quando chave já foi concluída', async () => {
    const prisma = {
      idempotencyRecord: {
        create: jest.fn().mockRejectedValue({ code: 'P2002' }),
        findFirst: jest.fn().mockResolvedValue({
          id: 'idem-1',
          payloadHash: 'hash',
          status: 'COMPLETED',
          response: { ok: true, id: 'r1' },
        }),
      },
    } as any

    const service = new IdempotencyService(prisma, requestContext, metrics)
    jest.spyOn(service, 'buildPayloadHash').mockReturnValue('hash')

    const result = await service.begin({
      orgId: 'org-1',
      scope: 'finance.create_charge',
      idempotencyKey: 'k1',
      payload: { a: 1 },
    })

    expect(result).toEqual({ mode: 'replay', recordId: 'idem-1', response: { ok: true, id: 'r1' } })
    expect(metrics.increment).toHaveBeenCalledWith('idempotencyReplays')
  })

  it('retorna erro estruturado para conflito de payload', async () => {
    const prisma = {
      idempotencyRecord: {
        create: jest.fn().mockRejectedValue({ code: 'P2002' }),
        findFirst: jest.fn().mockResolvedValue({
          id: 'idem-1',
          payloadHash: 'hash-original',
          status: 'COMPLETED',
          response: { ok: true },
        }),
      },
    } as any

    const service = new IdempotencyService(prisma, requestContext, metrics)
    jest.spyOn(service, 'buildPayloadHash').mockReturnValue('hash-diferente')

    await expect(
      service.begin({
        orgId: 'org-1',
        scope: 'finance.create_charge',
        idempotencyKey: 'k1',
        payload: { a: 2 },
      }),
    ).rejects.toMatchObject({
      response: {
        code: 'IDEMPOTENCY_KEY_CONFLICT',
      },
    })
    expect(metrics.increment).toHaveBeenCalledWith('idempotencyConflicts')
  })

  it('retorna conflito quando operação ainda está em progresso', async () => {
    const prisma = {
      idempotencyRecord: {
        create: jest.fn().mockRejectedValue({ code: 'P2002' }),
        findFirst: jest.fn().mockResolvedValue({
          id: 'idem-1',
          payloadHash: 'hash',
          status: 'PROCESSING',
          response: null,
        }),
      },
    } as any

    const service = new IdempotencyService(prisma, requestContext, metrics)
    jest.spyOn(service, 'buildPayloadHash').mockReturnValue('hash')

    await expect(
      service.begin({
        orgId: 'org-1',
        scope: 'finance.create_charge',
        idempotencyKey: 'k1',
        payload: { a: 1 },
      }),
    ).rejects.toBeInstanceOf(ConflictException)

    expect(metrics.increment).toHaveBeenCalledWith('idempotencyInProgress')
  })
})
