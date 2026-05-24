import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common'
import { WebhookService } from './webhook.service'

describe('WebhookService replay failed delivery', () => {
  const makeService = (delivery: any, jobState: string | null = null) => {
    const getState = jest.fn().mockResolvedValue(jobState)
    const getJob = jest.fn().mockResolvedValue(jobState ? { getState } : null)
    const queueService = {
      getQueue: jest.fn().mockReturnValue({ getJob }),
      addJob: jest.fn().mockResolvedValue({ id: 'webhook:dispatch:d1' }),
    }
    const prisma = {} as any
    const svc = new WebhookService(prisma, queueService as any)
    jest.spyOn(svc, 'getDeliveryContext').mockResolvedValue(delivery)
    jest.spyOn(svc, 'markDeliveryAttempt').mockResolvedValue({} as any)
    return { svc, queueService }
  }

  it('replay FAILED reenfileira com jobId determinístico', async () => {
    const delivery = { id: 'd1', status: 'FAILED', attempts: 5, endpointId: 'w1', endpoint: { orgId: 'org1' } }
    const { svc, queueService } = makeService(delivery)

    const result = await svc.replayFailedDelivery({ orgId: 'org1', deliveryId: 'd1', actorUserId: 'u1' })

    expect(queueService.addJob).toHaveBeenCalledWith(
      'webhooks',
      'dispatch-webhook',
      { deliveryId: 'd1' },
      expect.objectContaining({ jobId: 'webhook:dispatch:d1' }),
    )
    expect(result).toEqual(expect.objectContaining({ ok: true, deliveryId: 'd1', jobId: 'webhook:dispatch:d1' }))
  })

  it('bloqueia replay de SUCCESS', async () => {
    const delivery = { id: 'd1', status: 'SUCCESS', attempts: 1, endpointId: 'w1', endpoint: { orgId: 'org1' } }
    const { svc } = makeService(delivery)

    await expect(svc.replayFailedDelivery({ orgId: 'org1', deliveryId: 'd1', actorUserId: 'u1' })).rejects.toBeInstanceOf(BadRequestException)
  })

  it('isola tenant com 404', async () => {
    const delivery = { id: 'd1', status: 'FAILED', attempts: 1, endpointId: 'w1', endpoint: { orgId: 'org-other' } }
    const { svc } = makeService(delivery)

    await expect(svc.replayFailedDelivery({ orgId: 'org1', deliveryId: 'd1', actorUserId: 'u1' })).rejects.toBeInstanceOf(NotFoundException)
  })

  it('bloqueia replay duplicado quando já há job ativo', async () => {
    const delivery = { id: 'd1', status: 'FAILED', attempts: 5, endpointId: 'w1', endpoint: { orgId: 'org1' } }
    const { svc, queueService } = makeService(delivery, 'active')

    await expect(svc.replayFailedDelivery({ orgId: 'org1', deliveryId: 'd1', actorUserId: 'u1' })).rejects.toBeInstanceOf(ConflictException)
    expect(queueService.addJob).not.toHaveBeenCalled()
  })
})
