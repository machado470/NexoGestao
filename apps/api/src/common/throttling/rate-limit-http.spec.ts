import { Body, Controller, Get, INestApplication, Post, UseGuards, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { APP_GUARD } from '@nestjs/core'
import { ConfigService } from '@nestjs/config'
import { PassportModule } from '@nestjs/passport'
import { JwtService } from '@nestjs/jwt'
import { SkipThrottle, Throttle, ThrottlerModule } from '@nestjs/throttler'
import request from 'supertest'
import { AuthController } from '../../auth/auth.controller'
import { AuthService } from '../../auth/auth.service'
import { GoogleIdTokenVerifier } from '../../auth/google-id-token-verifier'
import { JwtStrategy } from '../../auth/jwt.strategy'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { PrismaService } from '../../prisma/prisma.service'
import { HealthController } from '../../health/health.controller'
import { BillingController } from '../../billing/billing.controller'
import { PaymentsController } from '../../payments/payments.controller'
import { WhatsAppController } from '../../whatsapp/whatsapp.controller'
import { PublicQuoteApprovalController } from '../../commerce/service-quotes'
import { PublicServiceAcceptanceController } from '../../service-orders/service-order-acceptance'
import { InvitesController } from '../../invites/invites.controller'
import { ExecutionController } from '../../execution/execution.controller'
import { FinanceController } from '../../finance/finance.controller'
import { OnboardingController } from '../../onboarding/onboarding.controller'
import { ANONYMOUS_THROTTLER, DEFAULT_THROTTLER, MINUTE_MS, NexoThrottlerGuard, SKIP_ALL_THROTTLERS, THROTTLERS, bodyTokenTracker } from './throttling'

// Regression for C7. Every browser request reaches the API through the BFF, so req.ip was the same
// for all users and every per-IP limit was shared by the whole platform (5 logins/min for everyone,
// 10 req/min for most routes). Throttlers named "short" were silently ignored, and signature-
// authenticated webhooks and Railway health checks were subject to the global limit.
const SECRET = 'c7-rate-limit-test-secret'
const jwt = new JwtService({ secret: SECRET })
const token = (sub: string, orgId: string, overrides: Record<string, unknown> = {}) =>
  jwt.sign({ sub, orgId, personId: `person-${sub}`, role: 'ADMIN', sessionVersion: 0, ...overrides }, { expiresIn: '1h' })

@Controller('probe')
@UseGuards(JwtAuthGuard)
class ProbeController {
  @Post('write') write() { return { ok: true } } // global default: 10/min per user
  @Get('read') @Throttle({ [DEFAULT_THROTTLER]: { limit: 120, ttl: MINUTE_MS } }) read() { return { ok: true } }
}

@Controller('public-probe')
class PublicProbeController {
  @Post('anonymous') anonymous() { return { ok: true } }
  @Post('link') @Throttle({ [DEFAULT_THROTTLER]: { limit: 30, ttl: MINUTE_MS, getTracker: bodyTokenTracker } }) link(@Body() _b: unknown) { return { ok: true } }
  @Post('signed-webhook') @SkipThrottle(SKIP_ALL_THROTTLERS) webhook() { return { ok: true } }
}

describe('C7: rate limiting over HTTP', () => {
  let app: INestApplication
  let now = Date.now()
  const realNow = Date.now.bind(Date)
  const auth = { login: jest.fn().mockResolvedValue({ success: true }), forgotPassword: jest.fn().mockResolvedValue({ ok: true }), register: jest.fn().mockResolvedValue({ ok: true }) }
  const persisted = (sub: string, orgId: string) => ({ id: sub, orgId, role: 'ADMIN', active: true, sessionVersion: 0, person: { id: `person-${sub}`, active: true } })
  const users: Record<string, any> = { 'user-a': persisted('user-a', 'org-a'), 'user-b': persisted('user-b', 'org-b'), 'user-a2': persisted('user-a2', 'org-a') }
  const http = () => request(app.getHttpServer())
  const previousSecret = process.env.JWT_SECRET

  beforeAll(() => { process.env.JWT_SECRET = SECRET; jest.spyOn(Date, 'now').mockImplementation(() => now) })
  afterAll(() => {
    jest.restoreAllMocks()
    if (previousSecret === undefined) delete process.env.JWT_SECRET
    else process.env.JWT_SECRET = previousSecret
  })

  beforeEach(async () => {
    jest.clearAllMocks()
    now = realNow()
    const module = await Test.createTestingModule({
      imports: [PassportModule, ThrottlerModule.forRoot(THROTTLERS)],
      controllers: [AuthController, ProbeController, PublicProbeController],
      providers: [JwtStrategy, GoogleIdTokenVerifier,
        { provide: ConfigService, useValue: { get: (key: string) => ({ JWT_SECRET: SECRET, NODE_ENV: 'test', GOOGLE_CLIENT_ID: 'test-client' } as any)[key] } },
        { provide: AuthService, useValue: auth },
        { provide: PrismaService, useValue: { user: { findUnique: async ({ where }: any) => users[where.id] ?? null } } },
        { provide: APP_GUARD, useClass: NexoThrottlerGuard },
      ],
    }).compile()
    app = module.createNestApplication()
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
    await app.init()
  })
  afterEach(async () => app?.close())

  const login = (email: string, headers: Record<string, string> = {}) =>
    http().post('/auth/login').set(headers).send({ email, password: 'secret-pass' })

  describe('authenticated routes are limited per user, not per shared BFF IP', () => {
    it('one user hitting the limit does not block other users of the same or another organization', async () => {
      const a = token('user-a', 'org-a')
      for (let i = 0; i < 10; i++) await http().post('/probe/write').auth(a, { type: 'bearer' }).expect(201)
      const blocked = await http().post('/probe/write').auth(a, { type: 'bearer' }).expect(429)
      expect(blocked.headers['retry-after']).toBeDefined()
      await http().post('/probe/write').auth(token('user-a2', 'org-a'), { type: 'bearer' }).expect(201)
      await http().post('/probe/write').auth(token('user-b', 'org-b'), { type: 'bearer' }).expect(201)
    })

    it('keeps route-specific limits (120/min reads) per user', async () => {
      const a = token('user-a', 'org-a')
      for (let i = 0; i < 120; i++) await http().get('/probe/read').auth(a, { type: 'bearer' }).expect(200)
      await http().get('/probe/read').auth(a, { type: 'bearer' }).expect(429)
      await http().get('/probe/read').auth(token('user-b', 'org-b'), { type: 'bearer' }).expect(200)
    })

    it('recovers after the window elapses', async () => {
      const a = token('user-a', 'org-a')
      for (let i = 0; i < 10; i++) await http().post('/probe/write').auth(a, { type: 'bearer' }).expect(201)
      await http().post('/probe/write').auth(a, { type: 'bearer' }).expect(429)
      now += MINUTE_MS + 1_000
      await http().post('/probe/write').auth(a, { type: 'bearer' }).expect(201)
    })

    it('does not give forged, expired or other-secret tokens their own bucket', async () => {
      const forged = [
        'not-a-jwt',
        new JwtService({ secret: 'attacker-secret' }).sign({ sub: 'user-a', orgId: 'org-a' }),
        jwt.sign({ sub: 'user-a', orgId: 'org-a', exp: Math.floor(realNow() / 1000) - 60 }),
      ]
      for (let i = 0; i < 10; i++) await http().post('/public-probe/anonymous').set('Authorization', `Bearer ${forged[i % forged.length]}-${i}`).expect(201)
      await http().post('/public-probe/anonymous').set('Authorization', `Bearer ${forged[0]}-x`).expect(429)
      await http().post('/public-probe/anonymous').expect(429)
    })
  })

  describe('credential endpoints (real AuthController)', () => {
    it('limits login attempts per account: the 6th attempt on the same account gets 429', async () => {
      for (let i = 0; i < 5; i++) await login('victim@org-a.test').expect(201)
      await login('victim@org-a.test').expect(429)
      await login('VICTIM@org-a.test ').expect(429)
      expect(auth.login).toHaveBeenCalledTimes(5)
    })

    it('attacks on one account do not lock out logins of other users behind the same BFF IP', async () => {
      for (let i = 0; i < 6; i++) await login('victim@org-a.test')
      for (const email of ['alice@org-a.test', 'bob@org-b.test', 'carol@org-b.test']) await login(email).expect(201)
    })

    it('caps anonymous credential attempts per IP (credential stuffing) at the anonymous auth ceiling', async () => {
      for (let i = 0; i < 100; i++) await login(`stuffing-${i}@example.test`).expect(201)
      await login('stuffing-100@example.test').expect(429)
    })

    it('recovers login for the account after the window', async () => {
      for (let i = 0; i < 6; i++) await login('victim@org-a.test')
      now += MINUTE_MS + 1_000
      await login('victim@org-a.test').expect(201)
    })

    it('applies per-account limits to password recovery and registration too', async () => {
      for (let i = 0; i < 5; i++) await http().post('/auth/forgot-password').send({ email: 'reset@org-a.test' }).expect(201)
      await http().post('/auth/forgot-password').send({ email: 'reset@org-a.test' }).expect(429)
      await http().post('/auth/forgot-password').send({ email: 'other@org-a.test' }).expect(201)
    })
  })

  describe('behind a proxy (trust proxy is off)', () => {
    it('ignores spoofed X-Forwarded-For / X-Real-IP: rotating them never resets the anonymous bucket', async () => {
      for (let i = 0; i < 10; i++) {
        await http().post('/public-probe/anonymous').set('X-Forwarded-For', `203.0.113.${i}`).set('X-Real-IP', `198.51.100.${i}`).expect(201)
      }
      await http().post('/public-probe/anonymous').set('X-Forwarded-For', '192.0.2.200').expect(429)
    })

    it('cannot bypass the per-account login limit by spoofing forwarding headers', async () => {
      for (let i = 0; i < 5; i++) await login('victim@org-a.test', { 'X-Forwarded-For': `203.0.113.${i}` }).expect(201)
      await login('victim@org-a.test', { 'X-Forwarded-For': '192.0.2.99' }).expect(429)
    })
  })

  describe('public links and signed webhooks', () => {
    it('limits public share links per token, so customers of different links are independent', async () => {
      for (let i = 0; i < 30; i++) await http().post('/public-probe/link').send({ token: 'link-1' }).expect(201)
      await http().post('/public-probe/link').send({ token: 'link-1' }).expect(429)
      await http().post('/public-probe/link').send({ token: 'link-2' }).expect(201)
    })

    it('never throttles signature-authenticated webhooks (provider retries/bursts)', async () => {
      for (let i = 0; i < 400; i++) await http().post('/public-probe/signed-webhook').expect(201)
    })
  })

  describe('route policy metadata on the real controllers', () => {
    const skip = (target: any, name: string) => Reflect.getMetadata(`THROTTLER:SKIP${name}`, target)
    const limit = (target: any, name: string) => Reflect.getMetadata(`THROTTLER:LIMIT${name}`, target)
    const tracker = (target: any, name: string) => Reflect.getMetadata(`THROTTLER:TRACKER${name}`, target)

    it.each([
      ['Stripe billing webhook', BillingController.prototype.handleWebhook],
      ['Stripe payments webhook', PaymentsController.prototype.handleStripeWebhook],
      ['WhatsApp webhook', WhatsAppController.prototype.webhook],
      ['WhatsApp legacy webhook', WhatsAppController.prototype.webhookLegacy],
      ['health', HealthController.prototype.health],
      ['health readiness (Railway healthcheck)', HealthController.prototype.readiness],
      ['health liveness', HealthController.prototype.liveness],
    ])('%s skips every throttler', (_label, handler) => {
      expect(skip(handler, DEFAULT_THROTTLER)).toBe(true)
      expect(skip(handler, ANONYMOUS_THROTTLER)).toBe(true)
    })

    it.each([
      ['login', AuthController.prototype.login],
      ['register', AuthController.prototype.register],
      ['forgot-password', AuthController.prototype.forgotPassword],
      ['reset-password', AuthController.prototype.resetPassword],
      ['verify-email', AuthController.prototype.verifyEmail],
      ['resend-email-verification', AuthController.prototype.resendEmailVerification],
      ['google bff-login', AuthController.prototype.googleBffLogin],
      ['accept-invite', InvitesController.prototype.acceptInvite],
    ])('%s is keyed per account/token under the anonymous auth ceiling', (_label, handler) => {
      expect(typeof tracker(handler, DEFAULT_THROTTLER)).toBe('function')
      expect(limit(handler, ANONYMOUS_THROTTLER)).toBe(100)
    })

    it('public share-link controllers are keyed per link token', () => {
      for (const controller of [PublicQuoteApprovalController, PublicServiceAcceptanceController]) {
        expect(tracker(controller, DEFAULT_THROTTLER)).toBe(bodyTokenTracker)
      }
    })

    it('no route uses a throttler name that does not exist (previously "short" was silently ignored)', () => {
      const handlers = [FinanceController, OnboardingController, ExecutionController, PaymentsController]
        .flatMap((controller) => Object.getOwnPropertyNames(controller.prototype).map((name) => (controller.prototype as any)[name]))
        .filter((fn) => typeof fn === 'function')
      for (const handler of handlers) expect(limit(handler, 'short')).toBeUndefined()
      // The intended 8/min payment limit now actually applies.
      expect(limit(PaymentsController.prototype.payCharge, DEFAULT_THROTTLER)).toBe(8)
    })
  })
})
