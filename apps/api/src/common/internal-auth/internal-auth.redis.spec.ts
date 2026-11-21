import IORedis from 'ioredis'
import { ChildProcess, spawn, spawnSync } from 'node:child_process'
import { createServer } from 'node:net'
import { randomBytes } from 'crypto'
import { THROTTLE_REDIS_CLIENT_OPTIONS } from '../throttling/redis-throttler.storage'
import { INTERNAL_AUTH_HEADER, NONCE_TTL_MS, bodyDigest, canonicalString, computeSignature } from './internal-auth.protocol'
import { InternalAuthService } from './internal-auth.service'

/**
 * C7.2d against a real, disposable redis-server (spawned on a free local port; never REDIS_URL):
 * nonce single use across two API replicas, concurrency, outage and reconnection.
 * REQUIRE_REDIS_SERVER=true (CI) turns a missing binary into a failure instead of a skip.
 */
const REDIS_BIN = process.env.REDIS_SERVER_BIN || 'redis-server'
const HAS_REDIS_BIN = spawnSync(REDIS_BIN, ['--version']).status === 0
if (process.env.REQUIRE_REDIS_SERVER === 'true' && !HAS_REDIS_BIN) {
  throw new Error(`REQUIRE_REDIS_SERVER=true but "${REDIS_BIN}" is not executable`)
}
if (!HAS_REDIS_BIN) console.warn('[internal-auth] redis-server not found: replay tests skipped')
const describeRedis = HAS_REDIS_BIN ? describe : describe.skip

const KEY = randomBytes(32)
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const freePort = () => new Promise<number>((resolve, reject) => {
  const server = createServer()
  server.once('error', reject)
  server.listen(0, '127.0.0.1', () => { const { port } = server.address() as { port: number }; server.close(() => resolve(port)) })
})
async function waitFor(check: () => Promise<boolean> | boolean, timeoutMs = 10_000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) { if (await check()) return; await sleep(50) }
  throw new Error('condition not met in time')
}
function signedRequest() {
  const ts = Math.floor(Date.now() / 1000)
  const nonce = randomBytes(16).toString('base64url')
  const canonical = canonicalString({ kid: 'k1', ts, nonce, method: 'GET', target: '/v1/me', bodySha256: bodyDigest('') })!
  return { method: 'GET', originalUrl: '/v1/me', headers: { [INTERNAL_AUTH_HEADER]: `v1.k1.${ts}.${nonce}.${computeSignature(KEY, canonical)}` } }
}

describeRedis('C7.2d: nonce replay protection on real Redis', () => {
  jest.setTimeout(20_000)
  let port: number
  let server: ChildProcess | null = null
  let admin: IORedis
  const services: InternalAuthService[] = []
  const prefix = `nexogestao:test:internal-auth:v1:${process.pid}:`

  const startRedis = async () => {
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
  const replica = async () => {
    const client = new IORedis({ host: '127.0.0.1', port, ...THROTTLE_REDIS_CLIENT_OPTIONS })
    const service = new InternalAuthService({ mode: 'observe', keys: new Map([['k1', KEY]]), keyPrefix: prefix }, client as any, Date.now, () => undefined)
    services.push(service)
    await service.onModuleInit()
    await waitFor(() => client.status === 'ready')
    return service
  }

  beforeAll(async () => {
    port = await freePort()
    admin = new IORedis({ host: '127.0.0.1', port, lazyConnect: true, maxRetriesPerRequest: 1, disconnectTimeout: 200, retryStrategy: () => 100 })
    admin.on('error', () => undefined)
    await startRedis()
  }, 20_000)
  afterAll(async () => {
    admin?.disconnect()
    await stopRedis()
  })
  beforeEach(async () => { if (!server) await startRedis(); await admin.flushall() })
  afterEach(async () => { while (services.length) await services.pop()!.onModuleDestroy() })

  it('a nonce accepted by one replica is a replay on the other', async () => {
    const [a, b] = [await replica(), await replica()]
    const req = signedRequest()
    expect((await a.verify(req)).status).toBe('valid')
    expect((await b.verify(req)).status).toBe('replay')
  })

  it('concurrent use of the same header across replicas: exactly one is valid', async () => {
    const [a, b] = [await replica(), await replica()]
    const req = signedRequest()
    const results = await Promise.all(Array.from({ length: 40 }, (_v, i) => (i % 2 ? b : a).verify(req)))
    expect(results.filter((r) => r.status === 'valid')).toHaveLength(1)
    expect(results.filter((r) => r.status === 'replay')).toHaveLength(39)
  })

  it('nonce keys are hashed, prefixed and expire with the documented TTL', async () => {
    const a = await replica()
    const req = signedRequest()
    await a.verify(req)
    const keys = await admin.keys('*')
    expect(keys).toHaveLength(1)
    expect(keys[0]).toMatch(new RegExp(`^${prefix}nonce:[0-9a-f]{64}$`))
    expect(keys[0]).not.toContain(req.headers[INTERNAL_AUTH_HEADER].split('.')[3])
    const ttl = await admin.pttl(keys[0])
    expect(ttl).toBeGreaterThan(NONCE_TTL_MS - 2_000)
    expect(ttl).toBeLessThanOrEqual(NONCE_TTL_MS)
  })

  it('Redis down: never valid (treated as absent); reconnects and verifies again', async () => {
    const a = await replica()
    await stopRedis()
    expect((await a.verify(signedRequest())).status).toBe('replay_check_unavailable')
    await startRedis()
    await waitFor(async () => (await a.verify(signedRequest())).status === 'valid')
  })
})
