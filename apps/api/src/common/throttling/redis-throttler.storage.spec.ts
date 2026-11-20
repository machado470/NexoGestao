import { Controller, Global, INestApplication, Logger, Module, Post } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { Test } from '@nestjs/testing'
import { Throttle, ThrottlerModule, getStorageToken } from '@nestjs/throttler'
import { QUEUE_CONNECTION } from '../../queue/queue.constants'
import { NexoThrottlerStorageModule } from './throttler-storage.module'
import { EventEmitter } from 'node:events'
import request from 'supertest'
import {
  NexoThrottlerStorage,
  SENSITIVE_KEY_PREFIX,
  THROTTLE_REDIS_CLIENT_OPTIONS,
  ThrottlerStorageUnavailableException,
  readThrottleStorageConfig,
} from './redis-throttler.storage'
import { DEFAULT_THROTTLER, MINUTE_MS, NexoThrottlerGuard, SENSITIVE_THROTTLE, SensitiveThrottle, THROTTLERS } from './throttling'
import { AuthController } from '../../auth/auth.controller'
import { InvitesController } from '../../invites/invites.controller'
import { PaymentsController } from '../../payments/payments.controller'
import { FinanceController } from '../../finance/finance.controller'
import { BillingController } from '../../billing/billing.controller'

// Deterministic tests of the C7.1 failure policy with a fake Redis client. Real Redis behaviour
// (atomic counters, TTL, two replicas, reconnect) is covered in redis-throttler.redis.spec.ts.
class FakeRedis extends EventEmitter {
  status = 'ready'
  fail = false
  calls = 0
  defineCommand = jest.fn()
  connect = jest.fn(async () => { this.emit('ready') })
  quit = jest.fn(async () => 'OK')
  disconnect = jest.fn()
  private hits = new Map<string, number>()
  nexoThrottleHit = jest.fn(async (hitsKey: string, _blockKey: string, ttl: number, limit: number) => {
    this.calls++
    if (this.fail) throw new Error('connect ECONNREFUSED redis://:s3cr3t-password@redis.internal:6379')
    const hits = (this.hits.get(hitsKey) ?? 0) + 1
    this.hits.set(hitsKey, hits)
    return hits > limit ? [hits, ttl, 1, ttl] : [hits, ttl, 0, 0]
  })
}

const storageWith = (client: FakeRedis, sensitiveFailure: 'closed' | 'local' = 'closed') =>
  new NexoThrottlerStorage({ mode: 'redis', client: client as any, sensitiveFailure, keyPrefix: 'test:throttle:' })

@Controller('policy')
class PolicyProbeController {
  @Post('common') common() { return { ok: true } }
  @Post('sensitive') @SensitiveThrottle() @Throttle({ [DEFAULT_THROTTLER]: { limit: 3, ttl: MINUTE_MS } }) sensitive() { return { ok: true } }
}

describe('C7.1 throttler storage configuration', () => {
  it('defaults to per-process counters and fail-closed sensitive routes', () => {
    expect(readThrottleStorageConfig({ NODE_ENV: 'production' })).toEqual({
      mode: 'memory', sensitiveFailure: 'closed', keyPrefix: 'nexogestao:production:throttle:v1:',
    })
    expect(readThrottleStorageConfig({ THROTTLE_STORAGE: ' Redis ', THROTTLE_REDIS_SENSITIVE_FAILURE: 'LOCAL' })).toMatchObject({ mode: 'redis', sensitiveFailure: 'local' })
  })

  it('rejects unknown values instead of silently disabling protection', () => {
    expect(() => readThrottleStorageConfig({ THROTTLE_STORAGE: 'off' })).toThrow('THROTTLE_STORAGE')
    expect(() => readThrottleStorageConfig({ THROTTLE_REDIS_SENSITIVE_FAILURE: 'open' })).toThrow('THROTTLE_REDIS_SENSITIVE_FAILURE')
  })

  it('memory mode opens no Redis connection', () => {
    const base = { duplicate: jest.fn() }
    const storage = NexoThrottlerStorage.fromEnvironment(base as any, { THROTTLE_STORAGE: 'memory' })
    expect(storage.mode).toBe('memory')
    expect(base.duplicate).not.toHaveBeenCalled()
  })

  it('redis mode duplicates the existing queue connection with fail-fast options (never reuses it directly)', () => {
    const fake = new FakeRedis()
    const base = { duplicate: jest.fn(() => fake) }
    const storage = NexoThrottlerStorage.fromEnvironment(base as any, { THROTTLE_STORAGE: 'redis', NODE_ENV: 'production' })
    expect(storage.mode).toBe('redis')
    expect(base.duplicate).toHaveBeenCalledWith(THROTTLE_REDIS_CLIENT_OPTIONS)
    expect(THROTTLE_REDIS_CLIENT_OPTIONS).toMatchObject({ enableOfflineQueue: false, maxRetriesPerRequest: 1 })
    expect(THROTTLE_REDIS_CLIENT_OPTIONS.commandTimeout).toBeLessThanOrEqual(500)
    expect(storage.redisKeys('abc')).toEqual({ hits: 'nexogestao:production:throttle:v1:{abc}:h', block: 'nexogestao:production:throttle:v1:{abc}:b' })
  })

  it('redis mode without a connection fails at boot', () => {
    expect(() => NexoThrottlerStorage.fromEnvironment(null, { THROTTLE_STORAGE: 'redis' })).toThrow('REDIS_URL')
  })
})

describe('C7.1 failure policy when Redis is unavailable', () => {
  it('common keys fall back to per-process counters: protection keeps limiting', async () => {
    const client = new FakeRedis(); client.fail = true
    const storage = storageWith(client)
    const results = []
    for (let i = 0; i < 4; i++) results.push(await storage.increment('common-key', MINUTE_MS, 3, MINUTE_MS, 'default'))
    expect(results.map((r) => r.isBlocked)).toEqual([false, false, false, true])
  })

  it('sensitive keys fail closed by default', async () => {
    const client = new FakeRedis(); client.fail = true
    await expect(storageWith(client).increment(`${SENSITIVE_KEY_PREFIX}k`, MINUTE_MS, 5, MINUTE_MS, 'default'))
      .rejects.toBeInstanceOf(ThrottlerStorageUnavailableException)
  })

  it('sensitive keys use per-process counters when THROTTLE_REDIS_SENSITIVE_FAILURE=local', async () => {
    const client = new FakeRedis(); client.fail = true
    const storage = storageWith(client, 'local')
    const results = []
    for (let i = 0; i < 3; i++) results.push(await storage.increment(`${SENSITIVE_KEY_PREFIX}k`, MINUTE_MS, 2, MINUTE_MS, 'default'))
    expect(results.map((r) => r.isBlocked)).toEqual([false, false, true])
  })

  it('a client that is not ready is not awaited (no request waits on Redis)', async () => {
    const client = new FakeRedis(); client.status = 'reconnecting'
    const record = await storageWith(client).increment('k', MINUTE_MS, 5, MINUTE_MS, 'default')
    expect(record.totalHits).toBe(1)
    expect(client.calls).toBe(0)
  })

  it('logs each state change once and never logs connection secrets', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined)
    try {
      const client = new FakeRedis(); client.fail = true
      const storage = storageWith(client)
      for (let i = 0; i < 5; i++) await storage.increment('k', MINUTE_MS, 50, MINUTE_MS, 'default')
      client.emit('error', new Error('redis://:s3cr3t-password@redis.internal'))
      client.fail = false
      for (let i = 0; i < 3; i++) await storage.increment('k', MINUTE_MS, 50, MINUTE_MS, 'default')
      expect(warn).toHaveBeenCalledTimes(1)
      expect(log).toHaveBeenCalledTimes(1)
      const output = JSON.stringify([...warn.mock.calls, ...log.mock.calls])
      expect(output).not.toMatch(/s3cr3t|redis:\/\/|redis\.internal/)
      expect(storage.isRedisHealthy).toBe(true)
    } finally {
      warn.mockRestore(); log.mockRestore()
    }
  })
})

describe('C7.1 failure policy over HTTP', () => {
  let app: INestApplication
  let client: FakeRedis
  const start = async (sensitiveFailure: 'closed' | 'local' = 'closed') => {
    client = new FakeRedis()
    const storage = storageWith(client, sensitiveFailure)
    const module = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot({ throttlers: THROTTLERS, storage })],
      controllers: [PolicyProbeController],
      providers: [{ provide: APP_GUARD, useClass: NexoThrottlerGuard }],
    }).compile()
    app = module.createNestApplication()
    await app.init()
  }
  afterEach(async () => app?.close())

  it('sensitive route answers 503 with Retry-After while Redis is down, and recovers', async () => {
    await start()
    await request(app.getHttpServer()).post('/policy/sensitive').expect(201)
    client.fail = true
    const res = await request(app.getHttpServer()).post('/policy/sensitive').expect(503)
    expect(res.headers['retry-after']).toBe('5')
    expect(res.body.code).toBe('RATE_LIMIT_UNAVAILABLE')
    client.fail = false
    await request(app.getHttpServer()).post('/policy/sensitive').expect(201)
  })

  it('common route keeps working on local counters and still answers 429 after the limit', async () => {
    await start()
    client.fail = true
    for (let i = 0; i < 10; i++) await request(app.getHttpServer()).post('/policy/common').expect(201)
    await request(app.getHttpServer()).post('/policy/common').expect(429)
  })

  it('sensitive route on local policy keeps limiting with local counters', async () => {
    await start('local')
    client.fail = true
    for (let i = 0; i < 3; i++) await request(app.getHttpServer()).post('/policy/sensitive').expect(201)
    await request(app.getHttpServer()).post('/policy/sensitive').expect(429)
  })
})

describe('C7.1 sensitive route classification on the real controllers', () => {
  const sensitive = (handler: any) => Reflect.getMetadata(SENSITIVE_THROTTLE, handler)
  it.each([
    ['login', AuthController.prototype.login],
    ['register', AuthController.prototype.register],
    ['google bff-login', AuthController.prototype.googleBffLogin],
    ['forgot-password', AuthController.prototype.forgotPassword],
    ['reset-password', AuthController.prototype.resetPassword],
    ['verify-email', AuthController.prototype.verifyEmail],
    ['resend-email-verification', AuthController.prototype.resendEmailVerification],
    ['accept-invite', InvitesController.prototype.acceptInvite],
    ['payments pay', PaymentsController.prototype.payCharge],
    ['payments checkout', PaymentsController.prototype.createCheckout],
    ['finance pay', FinanceController.prototype.payCharge],
    ['billing checkout', BillingController.prototype.createCheckoutSession],
  ])('%s is sensitive', (_label, handler) => expect(sensitive(handler)).toBe(true))

  it.each([
    ['google status', AuthController.prototype.googleStatus],
    ['billing plans', BillingController.prototype.getPlans],
  ])('%s is a common route', (_label, handler) => expect(sensitive(handler)).toBeUndefined())
})

describe('C7.1 application wiring (same as AppModule)', () => {
  const previous = process.env.THROTTLE_STORAGE
  afterEach(() => {
    if (previous === undefined) delete process.env.THROTTLE_STORAGE
    else process.env.THROTTLE_STORAGE = previous
  })

  const compile = async () => {
    const fake = new FakeRedis()
    const queueConnection = { duplicate: jest.fn(() => fake) }
    @Global() @Module({ providers: [{ provide: QUEUE_CONNECTION, useValue: queueConnection }], exports: [QUEUE_CONNECTION] })
    class FakeQueueModule {}
    const module = await Test.createTestingModule({
      imports: [
        FakeQueueModule,
        ThrottlerModule.forRootAsync({
          imports: [NexoThrottlerStorageModule],
          inject: [NexoThrottlerStorage],
          useFactory: (storage: NexoThrottlerStorage) => ({ throttlers: THROTTLERS, storage }),
        }),
      ],
      controllers: [PolicyProbeController],
      providers: [{ provide: APP_GUARD, useClass: NexoThrottlerGuard }],
    }).compile()
    const app = module.createNestApplication()
    await app.init()
    return { app, fake, queueConnection, module }
  }

  it('redis mode: the guard uses the shared storage, connected once on its own duplicated connection', async () => {
    process.env.THROTTLE_STORAGE = 'redis'
    const { app, fake, queueConnection, module } = await compile()
    try {
      expect(module.get(getStorageToken())).toBe(module.get(NexoThrottlerStorage))
      expect(queueConnection.duplicate).toHaveBeenCalledTimes(1)
      expect(fake.connect).toHaveBeenCalledTimes(1) // lifecycle hooks run twice on the same instance
      await request(app.getHttpServer()).post('/policy/common').expect(201)
      expect(fake.nexoThrottleHit).toHaveBeenCalled()
    } finally {
      await app.close()
    }
    expect(fake.quit).toHaveBeenCalledTimes(1)
  })

  it('memory mode (default): no Redis connection is opened', async () => {
    delete process.env.THROTTLE_STORAGE
    const { app, queueConnection } = await compile()
    try {
      await request(app.getHttpServer()).post('/policy/common').expect(201)
      expect(queueConnection.duplicate).not.toHaveBeenCalled()
    } finally {
      await app.close()
    }
  })
})
