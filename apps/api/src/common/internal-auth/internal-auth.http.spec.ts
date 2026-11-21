import { Body, Controller, Get, INestApplication, MiddlewareConsumer, Module, NestModule, Post, Req, UseGuards } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { Test } from '@nestjs/testing'
import { SkipThrottle, ThrottlerModule } from '@nestjs/throttler'
import { randomBytes } from 'crypto'
import request from 'supertest'
import { JwtStrategy } from '../../auth/jwt.strategy'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { PrismaService } from '../../prisma/prisma.service'
import { NexoThrottlerGuard, SKIP_ALL_THROTTLERS, THROTTLERS } from '../throttling/throttling'
import { INTERNAL_AUTH_HEADER, bodyDigest, canonicalString, computeSignature } from './internal-auth.protocol'
import { INTERNAL_AUTH_RESULT, InternalAuthMiddleware } from './internal-auth.middleware'
import { InternalAuthService } from './internal-auth.service'

// C7.2d over a real Nest HTTP stack: the middleware sees the exact wire request (target and raw
// body), but a valid BFF signature grants nothing: user auth, tenant and throttling are unchanged.
const SECRET = 'c7-2d-http-secret'
const jwt = new JwtService({ secret: SECRET })
const KEY = randomBytes(32)
const seen: unknown[] = []

@Controller()
class ProbeController {
  @Post('probe/echo') @SkipThrottle(SKIP_ALL_THROTTLERS) echo(@Req() req: any, @Body() _body: unknown) { seen.push(req[INTERNAL_AUTH_RESULT]); return { ok: true } }
  @Get('probe/limited') limited(@Req() req: any) { seen.push(req[INTERNAL_AUTH_RESULT]); return { ok: true } } // default 10/min per IP when anonymous
  @Get('probe/me') @UseGuards(JwtAuthGuard) me(@Req() req: any) { seen.push(req[INTERNAL_AUTH_RESULT]); return { orgId: req.user.orgId, sub: req.user.sub } }
  @Post('webhooks/provider') @SkipThrottle(SKIP_ALL_THROTTLERS) webhook() { return { received: true } }
  @Get('health/readiness') @SkipThrottle(SKIP_ALL_THROTTLERS) health() { return { status: 'ready' } }
}

class FakeRedis {
  status = 'ready'
  private keys = new Set<string>()
  on() { return this }
  async connect() {}
  async quit() { return 'OK' }
  disconnect() {}
  async set(k: string) { if (this.keys.has(k)) return null; this.keys.add(k); return 'OK' }
}

const service = new InternalAuthService({ mode: 'observe', keys: new Map([['k1', KEY]]), keyPrefix: 'test:' }, new FakeRedis() as any, Date.now, () => undefined)

@Module({
  imports: [PassportModule, ThrottlerModule.forRoot(THROTTLERS)],
  controllers: [ProbeController],
  providers: [
    JwtStrategy,
    { provide: InternalAuthService, useValue: service },
    InternalAuthMiddleware,
    { provide: ConfigService, useValue: { get: (key: string) => ({ JWT_SECRET: SECRET, NODE_ENV: 'test' } as Record<string, string>)[key] } },
    { provide: PrismaService, useValue: { user: { findUnique: async ({ where }: any) => ({ 'user-a': { id: 'user-a', orgId: 'org-a', role: 'ADMIN', active: true, sessionVersion: 0, person: { id: 'p', active: true } } } as any)[where.id] ?? null } } },
    { provide: APP_GUARD, useClass: NexoThrottlerGuard },
  ],
})
class ProbeModule implements NestModule {
  configure(consumer: MiddlewareConsumer) { consumer.apply(InternalAuthMiddleware).forRoutes('*') }
}

function sign(method: string, target: string, body = '') {
  const ts = Math.floor(Date.now() / 1000)
  const nonce = randomBytes(16).toString('base64url')
  const canonical = canonicalString({ kid: 'k1', ts, nonce, method, target, bodySha256: bodyDigest(body) })!
  return `v1.k1.${ts}.${nonce}.${computeSignature(KEY, canonical)}`
}

describe('C7.2d: internal auth over a real Nest HTTP stack (observe mode)', () => {
  let app: INestApplication
  const previousSecret = process.env.JWT_SECRET
  const http = () => request(app.getHttpServer())

  beforeAll(async () => {
    process.env.JWT_SECRET = SECRET
    const module = await Test.createTestingModule({ imports: [ProbeModule] }).compile()
    app = module.createNestApplication({ rawBody: true }) // same option as main.ts
    await app.init()
  })
  afterAll(async () => {
    await app?.close()
    if (previousSecret === undefined) delete process.env.JWT_SECRET
    else process.env.JWT_SECRET = previousSecret
  })
  beforeEach(() => { seen.length = 0 })

  it('verifies the exact wire request: target with query and the raw JSON body', async () => {
    const body = JSON.stringify({ email: 'a@b.test', nested: { x: [1, 2] } })
    await http().post('/probe/echo?x=1&y=%C3%A9').set(INTERNAL_AUTH_HEADER, sign('POST', '/probe/echo?x=1&y=%C3%A9', body)).set('content-type', 'application/json').send(body).expect(201)
    expect(seen[0]).toEqual({ status: 'valid', kid: 'k1' })
  })

  it('a replayed header is detected, and the request still runs exactly as before', async () => {
    const header = sign('GET', '/probe/me')
    const bearer = jwt.sign({ sub: 'user-a', orgId: 'org-a', role: 'ADMIN', personId: 'p', sessionVersion: 0 })
    await http().get('/probe/me').set(INTERNAL_AUTH_HEADER, header).auth(bearer, { type: 'bearer' }).expect(200)
    await http().get('/probe/me').set(INTERNAL_AUTH_HEADER, header).auth(bearer, { type: 'bearer' }).expect(200)
    expect(seen).toEqual([{ status: 'valid', kid: 'k1' }, { status: 'replay', kid: 'k1' }])
  })

  it('a valid signature does not replace user authentication (no JWT → 401)', async () => {
    await http().get('/probe/me').set(INTERNAL_AUTH_HEADER, sign('GET', '/probe/me')).expect(401)
  })

  it('tenant comes from the JWT only; a signature cannot select another organization', async () => {
    const bearer = jwt.sign({ sub: 'user-a', orgId: 'org-a', role: 'ADMIN', personId: 'p', sessionVersion: 0 })
    const res = await http().get('/probe/me?orgId=org-b').set(INTERNAL_AUTH_HEADER, sign('GET', '/probe/me?orgId=org-b')).set('x-org-id', 'org-b').auth(bearer, { type: 'bearer' }).expect(200)
    expect(res.body).toEqual({ orgId: 'org-a', sub: 'user-a' })
  })

  it('throttling is unchanged: signed requests get no extra quota', async () => {
    for (let i = 0; i < 10; i++) await http().get('/probe/limited').set(INTERNAL_AUTH_HEADER, sign('GET', '/probe/limited')).expect(200)
    await http().get('/probe/limited').set(INTERNAL_AUTH_HEADER, sign('GET', '/probe/limited')).expect(429)
    expect(seen.every((result: any) => result.status === 'valid')).toBe(true)
  })

  it('unsigned public routes, webhooks and health checks keep working', async () => {
    await http().post('/webhooks/provider').send({ event: 'x' }).expect(201)
    await http().get('/health/readiness').expect(200)
    await http().post('/probe/echo').send({ a: 1 }).expect(201)
    expect(seen[0]).toEqual({ status: 'missing', kid: null })
  })

  it('forged or tampered headers are only counted, never rejected or trusted', async () => {
    await http().post('/probe/echo').set(INTERNAL_AUTH_HEADER, 'v1.k1.forged').send({ a: 1 }).expect(201)
    await http().post('/probe/echo').set(INTERNAL_AUTH_HEADER, sign('POST', '/probe/echo', '{"a":1}')).set('content-type', 'application/json').send('{"a":2}').expect(201)
    expect(seen).toEqual([{ status: 'malformed', kid: null }, { status: 'bad_signature', kid: 'k1' }])
  })
})
