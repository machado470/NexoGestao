import { Controller, ExecutionContext, UnauthorizedException, INestApplication, Logger, Post, UseGuards, ValidationPipe } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { Test } from '@nestjs/testing'
import { Throttle, ThrottlerModule } from '@nestjs/throttler'
import IORedis from 'ioredis'
import { ChildProcess, spawn, spawnSync } from 'node:child_process'
import { createServer } from 'node:net'
import request from 'supertest'
import { AuthController } from '../../auth/auth.controller'
import { AuthService } from '../../auth/auth.service'
import { GoogleIdTokenVerifier } from '../../auth/google-id-token-verifier'
import { JwtStrategy } from '../../auth/jwt.strategy'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { JwtAuthGuard as LegacyJwtAuthGuard } from '../../auth/jwt-auth.guard'
import { RolesGuard } from '../../auth/guards/roles.guard'
import { OperationalStateGuard } from '../../people/operational-state.guard'
import { PaymentsController } from '../../payments/payments.controller'
import { PaymentsService } from '../../payments/payments.service'
import { ManualPaymentsService } from '../../finance/manual-payments.service'
import { PrismaService } from '../../prisma/prisma.service'
import { NexoThrottlerStorage, THROTTLE_REDIS_CLIENT_OPTIONS } from './redis-throttler.storage'
import { DEFAULT_THROTTLER, NexoThrottlerGuard, THROTTLERS } from './throttling'

/**
 * C7.1 against real Redis: two API instances, atomic counters, TTL, outage, reconnect, login and
 * payments. With the redis-server binary, a disposable server is spawned on a free local port and
 * every test runs (including outage/reconnect, which kill it). Without the binary, under
 * RUN_REAL_INTEGRATION=true the suite uses the disposable CI Redis (REDIS_URL) with per-test key
 * prefixes (nothing is flushed) and skips only the tests that need to kill the server.
 */
// Same parsing as test/integration/infra-guards (not importable: outside the build rootDir).
const RUN_REAL_INTEGRATION = ['1', 'true', 'yes', 'on'].includes((process.env.RUN_REAL_INTEGRATION ?? '').toLowerCase())
const REDIS_BIN = process.env.REDIS_SERVER_BIN || 'redis-server'
const HAS_REDIS_BIN = spawnSync(REDIS_BIN, ['--version']).status === 0
const EXTERNAL_REDIS_URL = !HAS_REDIS_BIN && RUN_REAL_INTEGRATION ? process.env.REDIS_URL : undefined
if (!HAS_REDIS_BIN && !EXTERNAL_REDIS_URL) console.warn('[redis-throttler] no redis-server binary and RUN_REAL_INTEGRATION is off: shared-counter tests skipped')
const describeRedis = HAS_REDIS_BIN || EXTERNAL_REDIS_URL ? describe : describe.skip
const itOutage = HAS_REDIS_BIN ? it : it.skip

const externalTarget = (raw: string) => {
  const url = new URL(raw)
  return {
    host: url.hostname, port: Number(url.port || 6379),
    username: url.username || undefined, password: url.password || undefined,
    db: Number(url.pathname.replace('/', '') || 0),
  }
}

const SECRET = 'c7-1-redis-throttle-secret'
const jwt = new JwtService({ secret: SECRET })
const token = (sub: string, orgId: string) =>
  jwt.sign({ sub, orgId, personId: `person-${sub}`, role: 'ADMIN', sessionVersion: 0 }, { expiresIn: '1h' })
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const freePort = () => new Promise<number>((resolve, reject) => {
  const server = createServer()
  server.once('error', reject)
  server.listen(0, '127.0.0.1', () => {
    const { port } = server.address() as { port: number }
    server.close(() => resolve(port))
  })
})

async function waitFor(check: () => Promise<boolean> | boolean, timeoutMs = 10_000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    if (await check()) return
    await sleep(50)
  }
  throw new Error('condition not met in time')
}

@Controller('probe')
@UseGuards(JwtAuthGuard)
class ProbeController {
  @Post('write') write() { return { ok: true } } // global default: 10/min per user
}

@Controller('public-probe')
class PublicProbeController {
  @Post('anonymous') anonymous() { return { ok: true } }
  @Post('short') @Throttle({ [DEFAULT_THROTTLER]: { limit: 2, ttl: 1_000 } }) short() { return { ok: true } }
  @Post('burst') @Throttle({ [DEFAULT_THROTTLER]: { limit: 10, ttl: 60_000 } }) burst() { return { ok: true } }
}

type Replica = { http: () => ReturnType<typeof request> }
const passthrough = { canActivate: () => true }
const userFromBearer = {
  canActivate: (context: ExecutionContext) => {
    const req = context.switchToHttp().getRequest()
    const payload = jwt.verify(String(req.headers.authorization ?? '').replace(/^Bearer\s+/i, ''))
    req.user = { ...payload, userId: payload.sub }
    return true
  },
}

describeRedis('C7.1: shared rate limit counters on real Redis', () => {
  jest.setTimeout(20_000)
  let port: number
  let target: { host: string; port: number; username?: string; password?: string; db?: number }
  let server: ChildProcess | null = null
  let admin: IORedis
  const basePrefix = `nexogestao:test:throttle:v1:c71-${process.pid}-${Date.now()}:`
  let testNumber = 0
  let prefix = basePrefix
  const storages: NexoThrottlerStorage[] = []
  const apps: INestApplication[] = []
  const auth = { login: jest.fn().mockResolvedValue({ success: true }) }
  const manualPayments = { pay: jest.fn().mockResolvedValue({ id: 'payment-1' }) }
  const persisted = (sub: string, orgId: string) => ({ id: sub, orgId, role: 'ADMIN', active: true, sessionVersion: 0, person: { id: `person-${sub}`, active: true } })
  const users: Record<string, any> = { 'user-a': persisted('user-a', 'org-a'), 'user-b': persisted('user-b', 'org-b') }
  const previousSecret = process.env.JWT_SECRET

  const startRedis = async () => {
    if (!HAS_REDIS_BIN) return
    server = spawn(REDIS_BIN, ['--port', String(port), '--bind', '127.0.0.1', '--save', '', '--appendonly', 'no'], { stdio: 'ignore' })
    await waitFor(async () => (await admin.ping().catch(() => null)) === 'PONG')
  }
  const stopRedis = async () => {
    if (!server) return
    const exited = new Promise((resolve) => server!.once('exit', resolve))
    server.kill('SIGKILL')
    await exited
    server = null
  }

  const newStorage = (sensitiveFailure: 'closed' | 'local' = 'closed', redisTarget = target) => {
    const storage = new NexoThrottlerStorage({
      mode: 'redis',
      sensitiveFailure,
      keyPrefix: prefix,
      connectTimeoutMs: 1_000,
      client: new IORedis({ ...redisTarget, ...THROTTLE_REDIS_CLIENT_OPTIONS }) as any,
    })
    storages.push(storage)
    return storage
  }

  /** One "API replica": its own Nest app, guard and Redis connection. */
  const replica = async (storage = newStorage()) => {
    await storage.onModuleInit()
    const module = await Test.createTestingModule({
      imports: [PassportModule, ThrottlerModule.forRoot({ throttlers: THROTTLERS, storage })],
      controllers: [AuthController, ProbeController, PublicProbeController, PaymentsController],
      providers: [JwtStrategy, GoogleIdTokenVerifier,
        { provide: ConfigService, useValue: { get: (key: string) => ({ JWT_SECRET: SECRET, NODE_ENV: 'test', GOOGLE_CLIENT_ID: 'test-client' } as any)[key] } },
        { provide: AuthService, useValue: auth },
        { provide: PaymentsService, useValue: {} },
        { provide: ManualPaymentsService, useValue: manualPayments },
        { provide: PrismaService, useValue: {
          user: { findUnique: async ({ where }: any) => users[where.id] ?? null },
          charge: { findFirst: async () => ({ amountCents: 1_000 }) },
        } },
        { provide: APP_GUARD, useClass: NexoThrottlerGuard },
      ],
    })
      .overrideGuard(LegacyJwtAuthGuard).useValue(userFromBearer)
      .overrideGuard(RolesGuard).useValue(passthrough)
      .overrideGuard(OperationalStateGuard).useValue(passthrough)
      .compile()
    const app = module.createNestApplication()
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
    await app.init()
    apps.push(app)
    return { http: () => request(app.getHttpServer()), storage }
  }

  const login = (r: Replica, email: string) =>
    r.http().post('/auth/login').send({ email, password: 'secret-pass' })
  const pay = (r: Replica, bearer: string, idempotencyKey: string) =>
    r.http().post('/payments/charges/charge-1/pay').auth(bearer, { type: 'bearer' }).set('Idempotency-Key', idempotencyKey).send({ method: 'PIX' })

  beforeAll(async () => {
    process.env.JWT_SECRET = SECRET
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined)
    port = await freePort()
    target = EXTERNAL_REDIS_URL ? externalTarget(EXTERNAL_REDIS_URL) : { host: '127.0.0.1', port }
    admin = new IORedis({ ...target, lazyConnect: true, maxRetriesPerRequest: 1, disconnectTimeout: 200, retryStrategy: () => 100 })
    admin.on('error', () => undefined)
    await startRedis()
  }, 20_000)

  afterAll(async () => {
    jest.restoreAllMocks()
    if (admin?.status === 'ready') {
      const leftovers = await admin.keys(`${basePrefix}*`)
      if (leftovers.length) await admin.del(...leftovers)
    }
    admin?.disconnect()
    await stopRedis()
    if (previousSecret === undefined) delete process.env.JWT_SECRET
    else process.env.JWT_SECRET = previousSecret
  })

  beforeEach(async () => {
    jest.clearAllMocks()
    auth.login.mockResolvedValue({ success: true })
    if (!server) await startRedis()
    prefix = `${basePrefix}${++testNumber}:`
  })

  afterEach(async () => {
    while (apps.length) await apps.pop()!.close()
    while (storages.length) await storages.pop()!.onModuleDestroy()
  })

  it('two instances share one counter per user: the limit is not multiplied by replicas', async () => {
    const [a, b] = [await replica(), await replica()]
    const bearer = token('user-a', 'org-a')
    for (let i = 0; i < 10; i++) await (i % 2 ? b : a).http().post('/probe/write').auth(bearer, { type: 'bearer' }).expect(201)
    await a.http().post('/probe/write').auth(bearer, { type: 'bearer' }).expect(429)
    const blocked = await b.http().post('/probe/write').auth(bearer, { type: 'bearer' }).expect(429)
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0)
    // Another tenant's user is unaffected on either replica.
    await b.http().post('/probe/write').auth(token('user-b', 'org-b'), { type: 'bearer' }).expect(201)
  })

  it('increments atomically under concurrent requests from two instances', async () => {
    const [a, b] = [await replica(), await replica()]
    const results = await Promise.all(Array.from({ length: 40 }, (_v, i) => (i % 2 ? b : a).http().post('/public-probe/burst')))
    expect(results.filter((r) => r.status === 201)).toHaveLength(10)
    expect(results.filter((r) => r.status === 429)).toHaveLength(30)
  })

  it('every key has a Redis TTL, uses the prefix and contains no e-mail, token or IP', async () => {
    const a = await replica()
    for (let i = 0; i < 6; i++) await login(a, 'Victim@Org-A.test')
    await a.http().post('/probe/write').auth(token('user-a', 'org-a'), { type: 'bearer' }).expect(201)
    const keys = await admin.keys(`${prefix}*`)
    expect(keys.length).toBeGreaterThan(0)
    for (const key of keys) {
      expect(key).toMatch(/^nexogestao:test:throttle:v1:[^{]*\{(sensitive:)?[0-9a-f]{64}\}:[hb]$/)
      expect(key).not.toMatch(/victim|org-a|user-a|127\.0\.0\.1|::ffff|eyJ/i)
      expect(await admin.pttl(key)).toBeGreaterThan(0)
    }
  })

  it('expires the window by Redis TTL: 429 with Retry-After, then allowed again', async () => {
    const a = await replica()
    await a.http().post('/public-probe/short').expect(201)
    await a.http().post('/public-probe/short').expect(201)
    const blocked = await a.http().post('/public-probe/short').expect(429)
    expect(blocked.headers['retry-after']).toBe('1')
    await sleep(1_150)
    await a.http().post('/public-probe/short').expect(201)
  })

  it('forged, expired or other-secret tokens share the anonymous bucket on every replica', async () => {
    const [a, b] = [await replica(), await replica()]
    const forged = [
      'not-a-jwt',
      new JwtService({ secret: 'attacker-secret' }).sign({ sub: 'user-a', orgId: 'org-a' }),
      jwt.sign({ sub: 'user-a', orgId: 'org-a', exp: Math.floor(Date.now() / 1000) - 60 }),
    ]
    for (let i = 0; i < 10; i++) {
      await (i % 2 ? b : a).http().post('/public-probe/anonymous')
        .set('Authorization', `Bearer ${forged[i % forged.length]}-${i}`)
        .set('X-Forwarded-For', `203.0.113.${i}`).set('X-Real-IP', `198.51.100.${i}`)
        .expect(201)
    }
    await a.http().post('/public-probe/anonymous').set('X-Forwarded-For', '192.0.2.1').expect(429)
    await b.http().post('/public-probe/anonymous').expect(429)
  })

  describe('login', () => {
    it('limits brute force per account across replicas without depending on the account existing', async () => {
      const [a, b] = [await replica(), await replica()]
      auth.login.mockRejectedValue(new UnauthorizedException('Credenciais inválidas'))
      for (let i = 0; i < 5; i++) await login(i % 2 ? b : a, 'victim@org-a.test')
      for (let i = 0; i < 5; i++) await login(i % 2 ? b : a, 'nobody@nowhere.test')
      // Same 429 for an existing and a non-existing account: no enumeration through the limiter.
      const existing = await login(a, 'victim@org-a.test').expect(429)
      const missing = await login(b, 'nobody@nowhere.test').expect(429)
      expect(existing.body).toEqual(missing.body)
      expect(auth.login).toHaveBeenCalledTimes(10)
    })

    it('legitimate users keep logging in while another account is under attack', async () => {
      const [a, b] = [await replica(), await replica()]
      for (let i = 0; i < 20; i++) await login(i % 2 ? b : a, 'victim@org-a.test')
      auth.login.mockClear()
      for (const email of ['alice@org-a.test', 'bob@org-b.test']) {
        await login(a, email).expect(201)
        await login(b, email).expect(201)
      }
      expect(auth.login).toHaveBeenCalledTimes(4)
    })
  })

  describe('payments', () => {
    it('keeps 8/min per user across replicas; a new or replayed idempotency key is not an exemption', async () => {
      const [a, b] = [await replica(), await replica()]
      const bearer = token('user-a', 'org-a')
      for (let i = 0; i < 8; i++) await pay(i % 2 ? b : a, bearer, `key-${i}`).expect(201)
      await pay(a, bearer, 'key-new').expect(429)
      await pay(b, bearer, 'key-0').expect(429)
      expect(manualPayments.pay).toHaveBeenCalledTimes(8)
      // Idempotency is preserved: the header reaches the payment service unchanged.
      expect(manualPayments.pay.mock.calls.map((call) => call[4])).toEqual(Array.from({ length: 8 }, (_v, i) => `key-${i}`))
      await pay(b, token('user-b', 'org-b'), 'key-0').expect(201)
    })

    itOutage('fails closed while Redis is down: no payment is executed without shared protection', async () => {
      const a = await replica()
      await stopRedis()
      const res = await pay(a, token('user-a', 'org-a'), 'key-down').expect(503)
      expect(res.headers['retry-after']).toBe('5')
      expect(manualPayments.pay).not.toHaveBeenCalled()
    })
  })

  describe('outage and reconnection', () => {
    itOutage('during an outage: sensitive routes 503, common routes keep limiting locally; shared again after reconnect', async () => {
      const a = await replica()
      const bearer = token('user-a', 'org-a')
      await a.http().post('/probe/write').auth(bearer, { type: 'bearer' }).expect(201)

      await stopRedis()
      await login(a, 'alice@org-a.test').expect(503)
      expect(auth.login).not.toHaveBeenCalled()
      for (let i = 0; i < 10; i++) await a.http().post('/probe/write').auth(bearer, { type: 'bearer' }).expect(201)
      await a.http().post('/probe/write').auth(bearer, { type: 'bearer' }).expect(429)

      await startRedis()
      await waitFor(async () => (await login(a, 'alice@org-a.test')).status === 201)
      expect(a.storage.isRedisHealthy).toBe(true)
      // Shared counters again (the restarted Redis has no persistence, so the window starts over).
      const b = await replica()
      expect(b.storage.isRedisHealthy).toBe(true)
      for (let i = 0; i < 10; i++) await (i % 2 ? b : a).http().post('/probe/write').auth(bearer, { type: 'bearer' }).expect(201)
      await b.http().post('/probe/write').auth(bearer, { type: 'bearer' }).expect(429)
      await a.http().post('/probe/write').auth(bearer, { type: 'bearer' }).expect(429)
    })

    it('boots with Redis unreachable (bounded wait) and applies the failure policy', async () => {
      const closedPort = await freePort()
      const started = Date.now()
      const a = await replica(newStorage('closed', { host: '127.0.0.1', port: closedPort }))
      expect(Date.now() - started).toBeLessThan(5_000)
      await login(a, 'alice@org-a.test').expect(503)
      for (let i = 0; i < 10; i++) await a.http().post('/public-probe/anonymous').expect(201)
      await a.http().post('/public-probe/anonymous').expect(429)
    })

    itOutage('local sensitive policy keeps login available with per-process limits during an outage', async () => {
      const a = await replica(newStorage('local'))
      await stopRedis()
      for (let i = 0; i < 5; i++) await login(a, 'victim@org-a.test').expect(201)
      await login(a, 'victim@org-a.test').expect(429)
    })
  })
})
