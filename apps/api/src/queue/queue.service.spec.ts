import { EventEmitter } from 'node:events'
import { QueueService } from './queue.service'
import { QUEUE_NAMES } from './queue.constants'

const queueCtor = jest.fn()
const queueEventsCtor = jest.fn()
const jobSchedulerCtor = jest.fn()

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation((...args) => {
    queueCtor(...args)
    return {
      name: args[0],
      add: jest.fn(),
      getJobCounts: jest.fn().mockResolvedValue({ waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 }),
      close: jest.fn(),
    }
  }),
  QueueEvents: jest.fn().mockImplementation((...args) => {
    queueEventsCtor(...args)
    return { close: jest.fn() }
  }),
  JobScheduler: jest.fn().mockImplementation((...args) => {
    jobSchedulerCtor(...args)
    return { close: jest.fn() }
  }),
}))

class FakeRedis extends EventEmitter {
  status = 'end'
  connect = jest.fn()
  ping = jest.fn().mockResolvedValue('PONG')
  quit = jest.fn().mockResolvedValue(undefined)
}

describe('QueueService degraded mode', () => {
  beforeEach(() => {
    queueCtor.mockClear()
    queueEventsCtor.mockClear()
    jobSchedulerCtor.mockClear()
  })

  it('não cria filas, eventos ou schedulers antes de o Redis estar habilitado', async () => {
    const redis = new FakeRedis()
    redis.status = 'connecting'
    process.nextTick(() => redis.emit('error', new Error('ECONNREFUSED')))
    const service = new QueueService(redis as any, {} as any)

    expect(queueCtor).not.toHaveBeenCalled()
    expect(queueEventsCtor).not.toHaveBeenCalled()
    expect(jobSchedulerCtor).not.toHaveBeenCalled()

    await expect(service.ensureEnabled()).resolves.toBe(false)

    expect(service.isEnabled()).toBe(false)
    expect(queueCtor).not.toHaveBeenCalled()
    expect(queueEventsCtor).not.toHaveBeenCalled()
    expect(jobSchedulerCtor).not.toHaveBeenCalled()
    await expect(service.getQueueStatus()).resolves.toMatchObject({
      ok: false,
      redisEnabled: false,
    })
  })

  it('registra filas uma única vez quando Redis fica pronto', async () => {
    const redis = new FakeRedis()
    redis.connect.mockImplementation(async () => {
      redis.status = 'ready'
      redis.emit('ready')
    })
    const service = new QueueService(redis as any, {} as any)

    await expect(service.ensureEnabled()).resolves.toBe(true)
    await expect(service.ensureEnabled()).resolves.toBe(true)

    expect(queueCtor).toHaveBeenCalledTimes(Object.values(QUEUE_NAMES).length)
    expect(queueEventsCtor).toHaveBeenCalledTimes(Object.values(QUEUE_NAMES).length)
    expect(jobSchedulerCtor).toHaveBeenCalledTimes(Object.values(QUEUE_NAMES).length)
  })
})
