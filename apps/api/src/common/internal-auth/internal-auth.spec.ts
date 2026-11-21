import { randomBytes } from 'crypto'
import {
  INTERNAL_AUTH_HEADER,
  MAX_CLOCK_SKEW_SECONDS,
  NONCE_TTL_MS,
  bodyDigest,
  canonicalString,
  computeSignature,
  parseInternalAuthHeader,
  signaturesEqual,
} from './internal-auth.protocol'
import { InternalAuthMetrics, InternalAuthService, readInternalAuthConfig } from './internal-auth.service'

// C7.2d: verifier side of the BFF → API HMAC. Test-only keys are generated at runtime (never real).
const NOW = 1_700_000_000_000
const key = (fill?: number) => (fill === undefined ? randomBytes(32) : Buffer.alloc(32, fill))

/** Independent signer for tests (mirrors apps/web/server/_core/internalAuth.ts). */
function sign(k: Buffer, kid: string, opts: { method?: string; target?: string; body?: string; ts?: number; nonce?: string } = {}) {
  const ts = opts.ts ?? Math.floor(NOW / 1000)
  const nonce = opts.nonce ?? randomBytes(16).toString('base64url')
  const canonical = canonicalString({ kid, ts, nonce, method: opts.method ?? 'POST', target: opts.target ?? '/v1/auth/login', bodySha256: bodyDigest(opts.body ?? '{"a":1}') })!
  return `v1.${kid}.${ts}.${nonce}.${computeSignature(k, canonical)}`
}

class FakeRedis {
  status = 'ready'
  fail = false
  store = new Map<string, number>()
  calls: unknown[][] = []
  on = jest.fn()
  connect = jest.fn(async () => undefined)
  quit = jest.fn(async () => 'OK')
  disconnect = jest.fn()
  async set(...args: any[]) {
    this.calls.push(args)
    if (this.fail) throw new Error('ECONNREFUSED redis://:secret@internal')
    const [k] = args
    if (this.store.has(k)) return null
    this.store.set(k, Date.now())
    return 'OK'
  }
}

const config = (keys: Record<string, Buffer>) => ({ mode: 'observe' as const, keys: new Map(Object.entries(keys)), keyPrefix: 'test:internal-auth:v1:' })
const request = (header: string | string[] | undefined, opts: { method?: string; target?: string; body?: string } = {}) => ({
  method: opts.method ?? 'POST',
  originalUrl: opts.target ?? '/v1/auth/login',
  headers: header === undefined ? {} : { [INTERNAL_AUTH_HEADER]: header },
  rawBody: Buffer.from(opts.body ?? '{"a":1}'),
})

describe('C7.2d protocol', () => {
  it('matches the shared known-answer vector (same as the BFF suite)', () => {
    const body = JSON.stringify({ a: 1 })
    expect(bodyDigest(body)).toBe('015abd7f5cc57a2dd94b7590f04ad8084273905ee33ec5cebeae62276a97f862')
    const canonical = canonicalString({ kid: 'k1', ts: 1700000000, nonce: 'AAAAAAAAAAAAAAAAAAAAAA', method: 'post', target: '/v1/auth/login?x=1', bodySha256: bodyDigest(body) })!
    expect(canonical.split('\n')).toEqual(['NEXO-INTERNAL-AUTH', 'v1', 'k1', '1700000000', 'AAAAAAAAAAAAAAAAAAAAAA', 'POST', '/v1/auth/login?x=1', bodyDigest(body)])
    expect(computeSignature(Buffer.alloc(32, 0x11), canonical)).toBe('DHgjpY_BffI0liBKmUyRZ5So0k3X9_RnmZ7R36KGhxM')
  })

  it('rejects ambiguous canonical inputs (newlines, spaces, bad fields)', () => {
    const base = { kid: 'k1', ts: 1700000000, nonce: 'AAAAAAAAAAAAAAAAAAAAAA', method: 'GET', target: '/v1/me', bodySha256: bodyDigest('') }
    expect(canonicalString(base)).not.toBeNull()
    for (const bad of [{ target: '/v1/me\nPOST' }, { target: '/v1/me x' }, { target: 'v1/me' }, { kid: 'k.1' }, { kid: 'k\n1' }, { method: 'GE T' }, { nonce: 'short' }, { bodySha256: 'xyz' }, { ts: 123 }]) {
      expect(canonicalString({ ...base, ...bad } as any)).toBeNull()
    }
  })

  it('parses only the exact v1 format', () => {
    const header = sign(key(), 'k1')
    expect(parseInternalAuthHeader(header)).toMatchObject({ kid: 'k1' })
    for (const bad of [undefined, '', 'v2' + header.slice(2), header + '.x', header.replace(/\.[^.]+$/, '.short'), 'v1.k1.17.AAAAAAAAAAAAAAAAAAAAAA.' + 'A'.repeat(43), 'x'.repeat(300), 42]) {
      expect(parseInternalAuthHeader(bad as any)).toBeNull()
    }
  })

  it('compares signatures in constant time on fixed-size digests', () => {
    const a = computeSignature(key(1), 'x')
    expect(signaturesEqual(a, a)).toBe(true)
    expect(signaturesEqual(a, computeSignature(key(2), 'x'))).toBe(false)
    expect(signaturesEqual(a, 'AAAA')).toBe(false)
  })

  it('keeps the nonce longer than the full acceptance window', () => {
    expect(NONCE_TTL_MS).toBeGreaterThan(2 * MAX_CLOCK_SKEW_SECONDS * 1000)
  })
})

describe('C7.2d configuration', () => {
  const k = (b: Buffer) => b.toString('base64')
  it('defaults to off and needs nothing', () => {
    expect(readInternalAuthConfig({}).mode).toBe('off')
    expect(readInternalAuthConfig({ NEXO_INTERNAL_AUTH_MODE: 'off', NEXO_INTERNAL_AUTH_KEYS: 'garbage' }).keys.size).toBe(0)
  })

  it('observe mode loads current and previous keys (base64 or base64url)', () => {
    const current = key(); const previous = key()
    const cfg = readInternalAuthConfig({ NEXO_INTERNAL_AUTH_MODE: 'observe', NEXO_INTERNAL_AUTH_KEYS: `k2:${k(current)}, k1:${previous.toString('base64url')}`, NODE_ENV: 'production' })
    expect([...cfg.keys.keys()]).toEqual(['k2', 'k1'])
    expect(cfg.keys.get('k1')!.equals(previous)).toBe(true)
    expect(cfg.keyPrefix).toBe('nexogestao:production:internal-auth:v1:')
  })

  it.each([
    [{ NEXO_INTERNAL_AUTH_MODE: 'enforce' }, 'NEXO_INTERNAL_AUTH_MODE'],
    [{ NEXO_INTERNAL_AUTH_MODE: 'observe' }, 'required'],
    [{ NEXO_INTERNAL_AUTH_MODE: 'observe', NEXO_INTERNAL_AUTH_KEYS: `bad.kid:${randomBytes(32).toString('base64')}` }, 'key id'],
    [{ NEXO_INTERNAL_AUTH_MODE: 'observe', NEXO_INTERNAL_AUTH_KEYS: `k1:${randomBytes(16).toString('base64')}` }, '32 bytes'],
    [{ NEXO_INTERNAL_AUTH_MODE: 'observe', NEXO_INTERNAL_AUTH_KEYS: 'k1:not*base64!!' }, '32 bytes'],
    [{ NEXO_INTERNAL_AUTH_MODE: 'observe', NEXO_INTERNAL_AUTH_KEYS: `k1:${randomBytes(32).toString('base64')},k1:${randomBytes(32).toString('base64')}` }, 'duplicated'],
    [{ NEXO_INTERNAL_AUTH_MODE: 'observe', NEXO_INTERNAL_AUTH_KEYS: ['a', 'b', 'c', 'd'].map((id) => `${id}:${randomBytes(32).toString('base64')}`).join(',') }, 'at most'],
  ])('rejects %j at boot without echoing key material', (env, message) => {
    let error: Error | undefined
    try { readInternalAuthConfig(env as NodeJS.ProcessEnv) } catch (e) { error = e as Error }
    expect(error?.message).toContain(message)
    const material = String((env as any).NEXO_INTERNAL_AUTH_KEYS ?? '').split(/[:,]/).filter((part) => part.length > 20)
    for (const secret of material) expect(error?.message).not.toContain(secret)
  })

  it('observe mode without Redis fails at boot; off mode opens nothing', () => {
    expect(() => new InternalAuthService(config({ k1: key() }), null)).toThrow('Redis')
    const base = { duplicate: jest.fn() }
    const off = InternalAuthService.fromEnvironment(base as any, {})
    expect(off.config.mode).toBe('off')
    expect(base.duplicate).not.toHaveBeenCalled()
  })
})

describe('C7.2d verification', () => {
  const k1 = key(); const k2 = key()
  const setup = (keys: Record<string, Buffer> = { k1 }) => {
    const redis = new FakeRedis()
    const service = new InternalAuthService(config(keys), redis as any, () => NOW, () => undefined)
    return { redis, service }
  }

  it('accepts a valid signature exactly once (atomic SET NX PX with the nonce TTL)', async () => {
    const { service, redis } = setup()
    const header = sign(k1, 'k1')
    expect(await service.verify(request(header))).toEqual({ status: 'valid', kid: 'k1' })
    expect(await service.verify(request(header))).toEqual({ status: 'replay', kid: 'k1' })
    expect(redis.calls[0]).toEqual([expect.stringMatching(/^test:internal-auth:v1:nonce:[0-9a-f]{64}$/), '1', 'PX', NONCE_TTL_MS, 'NX'])
    expect(JSON.stringify(redis.calls)).not.toContain(parseInternalAuthHeader(header)!.nonce)
  })

  it.each([
    ['missing', undefined, 'missing'],
    ['repeated header', ['a', 'b'], 'malformed'],
    ['garbage', 'v1.k1.garbage', 'malformed'],
  ])('%s → %s, without touching Redis', async (_label, header, status) => {
    const { service, redis } = setup()
    expect((await service.verify(request(header as any))).status).toBe(status)
    expect(redis.calls).toHaveLength(0)
  })

  it('unknown kid, expired and future timestamps are rejected before the nonce is consumed', async () => {
    const { service, redis } = setup()
    expect((await service.verify(request(sign(k1, 'k9')))).status).toBe('unknown_kid')
    const nowS = Math.floor(NOW / 1000)
    expect((await service.verify(request(sign(k1, 'k1', { ts: nowS - MAX_CLOCK_SKEW_SECONDS - 1 })))).status).toBe('expired')
    expect((await service.verify(request(sign(k1, 'k1', { ts: nowS + MAX_CLOCK_SKEW_SECONDS + 1 })))).status).toBe('future')
    expect((await service.verify(request(sign(k1, 'k1', { ts: nowS - MAX_CLOCK_SKEW_SECONDS })))).status).toBe('valid')
    expect(redis.calls).toHaveLength(1)
  })

  it.each([
    ['method', { method: 'DELETE' }],
    ['path', { target: '/v1/auth/register' }],
    ['query', { target: '/v1/auth/login?x=1' }],
    ['body', { body: '{"a":2}' }],
  ])('a signature does not survive a changed %s (and burns no nonce)', async (_label, change) => {
    const { service, redis } = setup()
    const header = sign(k1, 'k1')
    expect((await service.verify(request(header, change))).status).toBe('bad_signature')
    expect(redis.calls).toHaveLength(0)
    expect((await service.verify(request(header))).status).toBe('valid')
  })

  it('a signature does not survive a changed kid, timestamp, nonce or key', async () => {
    const { service } = setup({ k1, k2 })
    const header = sign(k1, 'k1')
    const [v, kid, ts, nonce, sig] = header.split('.')
    expect((await service.verify(request([v, 'k2', ts, nonce, sig].join('.')))).status).toBe('bad_signature')
    expect((await service.verify(request([v, kid, String(Number(ts) - 1), nonce, sig].join('.')))).status).toBe('bad_signature')
    expect((await service.verify(request([v, kid, ts, randomBytes(16).toString('base64url'), sig].join('.')))).status).toBe('bad_signature')
    expect((await service.verify(request(sign(key(), 'k1')))).status).toBe('bad_signature')
  })

  it('an absent body is bound as the empty body', async () => {
    const { service } = setup()
    const header = sign(k1, 'k1', { method: 'GET', target: '/v1/me', body: '' })
    expect((await service.verify({ method: 'GET', originalUrl: '/v1/me', headers: { [INTERNAL_AUTH_HEADER]: header } })).status).toBe('valid')
  })

  it('Redis unavailable → replay_check_unavailable (never valid)', async () => {
    const down = setup(); down.redis.status = 'reconnecting'
    expect((await down.service.verify(request(sign(k1, 'k1')))).status).toBe('replay_check_unavailable')
    const failing = setup(); failing.redis.fail = true
    expect((await failing.service.verify(request(sign(k1, 'k1')))).status).toBe('replay_check_unavailable')
  })

  it('key rotation: the previous key stays valid while listed and stops once removed', async () => {
    const rotating = setup({ k2, k1 })
    expect((await rotating.service.verify(request(sign(k1, 'k1')))).status).toBe('valid')
    expect((await rotating.service.verify(request(sign(k2, 'k2')))).status).toBe('valid')
    const rotated = setup({ k2 })
    expect((await rotated.service.verify(request(sign(k1, 'k1')))).status).toBe('unknown_kid')
  })

  it('off mode reports disabled and never verifies', async () => {
    const service = new InternalAuthService({ ...config({ k1 }), mode: 'off' }, null)
    expect((await service.verify(request(sign(k1, 'k1')))).status).toBe('disabled')
  })
})

describe('C7.2d metrics and logs', () => {
  it('summaries carry only bounded counts, Railway-friendly fields and no secrets', async () => {
    const lines: string[] = []
    const k1 = key()
    const redis = new FakeRedis()
    const service = new InternalAuthService(config({ k1 }), redis as any, () => NOW, (line) => lines.push(line), 1000)
    const header = sign(k1, 'k1')
    for (const h of [header, header, undefined, 'junk', sign(key(), 'k1')]) {
      const result = await service.verify(request(h))
      service.metrics.record(result.status, result.kid)
    }
    service.flushSummary()
    service.flushSummary() // empty window: nothing
    expect(lines).toHaveLength(1)
    const summary = JSON.parse(lines[0])
    expect(summary).toMatchObject({ level: 'info', message: 'internal_auth_summary', event: 'internal_auth_summary', mode: 'observe', total: 5 })
    expect(summary.statuses).toEqual({ bad_signature: 1, malformed: 1, missing: 1, replay: 1, 'valid:k1': 1 })
    const [, , , nonce, sig] = header.split('.')
    expect(lines[0]).not.toContain(nonce)
    expect(lines[0]).not.toContain(sig)
    expect(lines[0]).not.toContain(k1.toString('base64'))
  })

  it('cardinality stays bounded under hostile input', () => {
    const metrics = new InternalAuthMetrics()
    for (let i = 0; i < 5000; i++) metrics.record(i % 2 ? 'malformed' : 'unknown_kid', `kid-${i}`)
    expect(Object.keys(metrics.snapshot().statuses)).toEqual(['malformed', 'unknown_kid'])
  })
})
