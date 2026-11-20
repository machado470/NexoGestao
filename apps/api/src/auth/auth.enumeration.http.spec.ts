import { INestApplication, Logger, ValidationPipe } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { Test } from '@nestjs/testing'
import { ThrottlerModule } from '@nestjs/throttler'
import * as bcrypt from 'bcrypt'
import request from 'supertest'
import { AuthController } from './auth.controller'
import {
  AUTH_EMAIL_RESPONSE_FLOOR_DEFAULT_MS,
  AUTH_EMAIL_RESPONSE_FLOOR_MAX_MS,
  AuthService,
  INVALID_CREDENTIALS_CODE,
  INVALID_CREDENTIALS_MESSAGE,
  readAuthEmailResponseFloorMs,
} from './auth.service'
import { GoogleIdTokenVerifier } from './google-id-token-verifier'
import { BCRYPT_ROUNDS, compareSecretOrDummy, dummyBcryptHash } from './password-hashing'
import { InvitesController } from '../invites/invites.controller'
import { INVALID_INVITE_CODE, INVALID_INVITE_MESSAGE, InvitesService } from '../invites/invites.service'
import { EmailService } from '../email/email.service'
import { PrismaService } from '../prisma/prisma.service'
import { AnalyticsService } from '../analytics/analytics.service'
import { ApiExceptionFilter } from '../common/http/api-exception.filter'
import { NexoThrottlerGuard, THROTTLERS } from '../common/throttling/throttling'

/**
 * C7.2b: an unauthenticated caller must not learn whether an account (or a pending invite)
 * exists from login, invite acceptance or recovery responses, nor from gross timing gaps.
 * Uses the real controllers and services, real bcrypt at the production cost, the C7.2a filter
 * and the C7.1 throttler; only Prisma, Resend and analytics are in-memory.
 */
const SECRET = 'c7-2b-enumeration-secret'
/** Shorter than production (1000 ms) to keep the suite fast; same code path. */
const FLOOR_MS = 300
const PASSWORD = 'Correct-horse-9'

type FakeUser = {
  id: string; orgId: string; email: string; role: string; password: string | null; active: boolean
  emailVerifiedAt: Date | null; sessionVersion: number; inviteToken?: string | null; inviteExpiresAt?: Date | null
  person: { id: string; active: boolean } | null
}

describe('C7.2b: account enumeration over HTTP', () => {
  let app: INestApplication
  let users: FakeUser[]
  let enforceVerification = false
  const send = jest.fn()
  const http = () => request(app.getHttpServer())
  const jwt = new JwtService({ secret: SECRET })

  const user = (overrides: Partial<FakeUser>): FakeUser => ({
    id: `user-${users.length + 1}`, orgId: 'org-a', email: `u${users.length + 1}@org-a.test`, role: 'ADMIN',
    password: null, active: true, emailVerifiedAt: new Date(), sessionVersion: 0, person: { id: `person-${users.length + 1}`, active: true },
    ...overrides,
  })

  const prisma = {
    user: {
      findUnique: jest.fn(async ({ where }: any) => users.find((u) => u.email === where.email) ?? null),
      findFirst: jest.fn(async ({ where }: any) => users.find((u) =>
        u.email === where.email && u.active === where.active && u.password === where.password &&
        !!u.inviteExpiresAt && u.inviteExpiresAt > new Date()) ?? null),
      update: jest.fn(async () => ({})),
      updateMany: jest.fn(async () => ({ count: 1 })),
      create: jest.fn(),
    },
    organization: { findUnique: jest.fn(), create: jest.fn() },
    auditEvent: { create: jest.fn() },
    $transaction: jest.fn(),
  }

  const body = (res: request.Response) => {
    const { path: _path, requestId: _requestId, ...rest } = res.body
    return rest
  }

  beforeAll(async () => {
    process.env.JWT_SECRET = SECRET
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined)
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)
    users = []
    const hash = await bcrypt.hash(PASSWORD, BCRYPT_ROUNDS)
    users.push(
      user({ email: 'active@org-a.test', password: hash }),
      user({ email: 'inactive@org-a.test', password: hash, active: false }),
      user({ email: 'noperson@org-a.test', password: hash, person: { id: 'p', active: false } }),
      user({ email: 'unverified@org-a.test', password: hash, emailVerifiedAt: null }),
      user({ email: 'other@org-b.test', orgId: 'org-b', password: hash }),
      user({ email: 'pending@org-a.test', active: false, password: null, person: null,
        inviteToken: await bcrypt.hash('good-invite-token', BCRYPT_ROUNDS), inviteExpiresAt: new Date(Date.now() + 86_400_000) }),
    )
    const module = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot(THROTTLERS)],
      controllers: [AuthController, InvitesController],
      providers: [
        AuthService, InvitesService, GoogleIdTokenVerifier,
        { provide: JwtService, useValue: jwt },
        { provide: PrismaService, useValue: prisma },
        { provide: AnalyticsService, useValue: { track: jest.fn() } },
        { provide: EmailService, useValue: { sendInvite: jest.fn() } },
        { provide: ConfigService, useValue: { get: (key: string) => ({
          JWT_SECRET: SECRET, NODE_ENV: 'test', FRONTEND_URL: 'https://app.test',
          AUTH_ENFORCE_EMAIL_VERIFICATION: enforceVerification ? 'true' : 'false',
          AUTH_EMAIL_RESPONSE_FLOOR_MS: String(FLOOR_MS),
        } as Record<string, string>)[key] } },
        { provide: APP_GUARD, useClass: NexoThrottlerGuard },
      ],
    }).compile()
    app = module.createNestApplication()
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
    app.useGlobalFilters(new ApiExceptionFilter())
    await app.init()
    ;(app.get(AuthService) as any).resend = { emails: { send } }
  })

  afterAll(async () => {
    await app?.close()
    jest.restoreAllMocks()
  })

  beforeEach(() => {
    send.mockReset().mockResolvedValue({ data: { id: 'email' }, error: null })
    prisma.user.update.mockClear()
  })

  const login = (email: string, password = 'Wrong-password-1') => http().post('/auth/login').send({ email, password })

  describe('login before the password is proven', () => {
    it.each([
      ['unknown e-mail', 'nobody@nowhere.test'],
      ['existing account, wrong password', 'active@org-a.test'],
      ['inactive account, wrong password', 'inactive@org-a.test'],
      ['account without operational identity, wrong password', 'noperson@org-a.test'],
      ['unverified account, wrong password', 'unverified@org-a.test'],
      ['pending invite (no password yet)', 'pending@org-a.test'],
    ])('%s gets the same 401 and body', async (_label, email) => {
      const res = await login(email).expect(401)
      expect(body(res)).toEqual({ success: false, error: INVALID_CREDENTIALS_MESSAGE, message: INVALID_CREDENTIALS_MESSAGE, code: INVALID_CREDENTIALS_CODE, data: null })
    })

    it('the response never carries account, organization or role data', async () => {
      for (const email of ['nobody@nowhere.test', 'active@org-a.test', 'other@org-b.test']) {
        const text = JSON.stringify((await login(email)).body)
        expect(text).not.toMatch(/org-a|org-b|ADMIN|user-\d|person|email/)
      }
    })
  })

  describe('after the password is proven', () => {
    it('logs in and scopes the session to the account organization', async () => {
      const a = await login('active@org-a.test', PASSWORD).expect(201)
      expect(jwt.verify(a.body.token)).toMatchObject({ orgId: 'org-a', sub: 'user-1' })
      const b = await login('other@org-b.test', PASSWORD).expect(201)
      expect(jwt.verify(b.body.token)).toMatchObject({ orgId: 'org-b' })
    })

    it('explains inactive and identity-less accounts only to whoever knows the password', async () => {
      expect((await login('inactive@org-a.test', PASSWORD).expect(401)).body.message).toBe('Conta não ativada')
      expect((await login('noperson@org-a.test', PASSWORD).expect(401)).body.message).toBe('Usuário sem identidade operacional ativa')
    })

    it('keeps EMAIL_NOT_VERIFIED for the right password when verification is enforced', async () => {
      const service = app.get(AuthService) as any
      const previous = service.enforceEmailVerification
      service.enforceEmailVerification = true
      try {
        const res = await login('unverified@org-a.test', PASSWORD).expect(401)
        expect(res.body.code).toBe('EMAIL_NOT_VERIFIED')
        expect(res.body).not.toHaveProperty('email')
        expect(body(await login('unverified@org-a.test').expect(401)).code).toBe(INVALID_CREDENTIALS_CODE)
      } finally {
        service.enforceEmailVerification = previous
      }
    })
  })

  describe('timing (bounded mitigation, not constant time)', () => {
    const median = (values: number[]) => values.sort((a, b) => a - b)[Math.floor(values.length / 2)]
    const timed = async (email: string) => {
      const start = process.hrtime.bigint()
      await app.get(AuthService).login(email, 'Wrong-password-1').catch(() => undefined)
      return Number(process.hrtime.bigint() - start) / 1e6
    }

    it('unknown e-mails also pay one bcrypt comparison at the production cost', async () => {
      await dummyBcryptHash()
      const unknown: number[] = []
      const known: number[] = []
      for (let i = 0; i < 6; i++) {
        unknown.push(await timed(`ghost-${i}@nowhere.test`))
        known.push(await timed('active@org-a.test'))
      }
      // Before C7.2b the unknown path skipped bcrypt (~1 ms vs ~50 ms). Only gross gaps are
      // asserted: equal timing is not guaranteed (DB lookup, scheduler and network jitter).
      expect(median(unknown)).toBeGreaterThan(median(known) * 0.5)
      expect(median(unknown)).toBeLessThan(median(known) * 2)
    })

    it('the dummy hash uses the production cost and is created once per process', async () => {
      const first = await dummyBcryptHash()
      expect(first).toMatch(new RegExp(`^\\$2[aby]\\$${String(BCRYPT_ROUNDS).padStart(2, '0')}\\$`))
      expect(await dummyBcryptHash()).toBe(first)
      expect(dummyBcryptHash()).toBe(dummyBcryptHash())
    })

    it('compareSecretOrDummy never matches without a stored hash, nor on malformed hashes', async () => {
      expect(await compareSecretOrDummy(PASSWORD, null)).toBe(false)
      expect(await compareSecretOrDummy(PASSWORD, '')).toBe(false)
      expect(await compareSecretOrDummy(PASSWORD, 'not-a-bcrypt-hash')).toBe(false)
      expect(await compareSecretOrDummy(PASSWORD, users[0].password)).toBe(true)
    })
  })

  describe('rate limiting stays account-keyed and identical (C7.1 / C7.2a)', () => {
    it('the 6th attempt answers the same 429 RATE_LIMITED for existing and unknown accounts', async () => {
      const responses = []
      for (const email of ['active@org-a.test', 'never-registered@nowhere.test']) {
        for (let i = 0; i < 5; i++) await login(email)
        responses.push(await login(email).expect(429))
      }
      expect(responses.map((r) => body(r))).toEqual([body(responses[1]), body(responses[1])])
      expect(responses[0].body.code).toBe('RATE_LIMITED')
      for (const res of responses) expect(Number(res.headers['retry-after'])).toBeGreaterThan(0)
    })
  })

  describe('invite acceptance', () => {
    const accept = (email: string, token: string) =>
      http().post('/auth/accept-invite').send({ email, token, name: 'Ana Teste', password: 'Password123!' })

    it.each([
      ['unknown e-mail', 'nobody@nowhere.test', 'any-token'],
      ['pending invite, wrong token', 'pending@org-a.test', 'wrong-token'],
      ['active account (no pending invite)', 'active@org-a.test', 'any-token'],
    ])('%s gets the same 401', async (_label, email, token) => {
      const res = await accept(email, token).expect(401)
      expect(body(res)).toEqual({ success: false, error: INVALID_INVITE_MESSAGE, message: INVALID_INVITE_MESSAGE, code: INVALID_INVITE_CODE, data: null })
      expect(prisma.user.updateMany).not.toHaveBeenCalled()
    })
  })

  describe('password recovery and verification resend (synchronous delivery + response floor)', () => {
    const timedPost = async (route: string, email: string) => {
      const started = performance.now()
      const res = await http().post(`/auth/${route}`).send({ email })
      return { res, ms: performance.now() - started }
    }
    const providerTaking = (ms: number, outcome: 'ok' | 'reject' = 'ok') => {
      const state = { settled: false }
      send.mockImplementation(() => new Promise((resolve, reject) => setTimeout(() => {
        state.settled = true
        if (outcome === 'reject') reject(new Error('provider payload with https://app.test/reset-password?token=secret'))
        else resolve({ data: { id: 'email' }, error: null })
      }, ms)))
      return state
    }
    const routes = [
      ['forgot-password', 'active@org-a.test'],
      ['resend-email-verification', 'unverified@org-a.test'],
    ] as const

    it.each(routes)('%s: existing and unknown accounts answer the same, no earlier than the floor', async (route, email) => {
      providerTaking(100)
      const known = await timedPost(route, email)
      const unknown = await timedPost(route, `nobody-${route}@nowhere.test`)
      expect(known.res.status).toBe(201)
      expect(known.res.body).toEqual(unknown.res.body)
      expect(known.res.body.message).toContain('Solicitação recebida')
      for (const { ms } of [known, unknown]) expect(ms).toBeGreaterThanOrEqual(FLOOR_MS - 5)
      // Gross gap removed while the provider is faster than the floor (bounded, not constant).
      expect(Math.abs(known.ms - unknown.ms)).toBeLessThan(150)
    })

    it.each(routes)('%s: the e-mail is sent before the response (delivery guarantee unchanged)', async (route, email) => {
      const provider = providerTaking(100)
      const { res } = await timedPost(route, email)
      expect(res.status).toBe(201)
      expect(send).toHaveBeenCalledTimes(1)
      expect(provider.settled).toBe(true)
      expect(JSON.stringify(send.mock.calls[0][0])).toContain(email)
    })

    it('a provider slower than the floor delays only that response, without adding the floor on top', async () => {
      providerTaking(600)
      const { res, ms } = await timedPost('forgot-password', 'active@org-a.test')
      expect(res.status).toBe(201)
      expect(ms).toBeGreaterThanOrEqual(595)
      expect(ms).toBeLessThan(600 + FLOOR_MS)
    })

    it('a provider failure keeps the same answer and floor, and is logged with a reason code only', async () => {
      const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)
      error.mockClear()
      providerTaking(50, 'reject')
      const known = await timedPost('forgot-password', 'other@org-b.test')
      const unknown = await timedPost('forgot-password', 'nobody-fail@nowhere.test')
      expect(known.res.body).toEqual(unknown.res.body)
      expect(known.ms).toBeGreaterThanOrEqual(FLOOR_MS - 5)
      expect(JSON.stringify(error.mock.calls)).toContain('password_reset_delivery_failed')
      expect(JSON.stringify(error.mock.calls)).not.toMatch(/token=|provider payload|other@org-b/)
    })

    it('while the delivery has not completed (crash/restart window) nothing is acknowledged', async () => {
      let release!: () => void
      send.mockImplementation(() => new Promise((resolve) => { release = () => resolve({ data: { id: 'email' }, error: null }) }))
      const pending = http().post('/auth/forgot-password').send({ email: 'active@org-a.test' }).timeout(FLOOR_MS + 700)
      await expect(pending).rejects.toMatchObject({ timeout: FLOOR_MS + 700 })
      expect(send).toHaveBeenCalledTimes(1)
      release()
    })

    it('routes that do not need the mitigation are not delayed by it', async () => {
      const login = performance.now()
      await http().post('/auth/login').send({ email: 'floor-check@nowhere.test', password: 'Wrong-password-1' }).expect(401)
      expect(performance.now() - login).toBeLessThan(FLOOR_MS)
      // The global "e-mail unavailable" answer does not depend on the account: immediate, unchanged.
      const service = app.get(AuthService) as any
      const resend = service.resend
      service.resend = null
      try {
        const started = performance.now()
        const res = await http().post('/auth/forgot-password').send({ email: 'noperson@org-a.test' }).expect(503)
        expect(performance.now() - started).toBeLessThan(FLOOR_MS)
        expect(res.body.code).toBe('SERVICE_UNAVAILABLE')
      } finally {
        service.resend = resend
      }
    })
  })

  describe('AUTH_EMAIL_RESPONSE_FLOOR_MS validation', () => {
    it('defaults to 1000 ms and accepts integers within [0, 5000]', () => {
      expect(AUTH_EMAIL_RESPONSE_FLOOR_DEFAULT_MS).toBe(1000)
      expect(AUTH_EMAIL_RESPONSE_FLOOR_MAX_MS).toBe(5000)
      expect(readAuthEmailResponseFloorMs(undefined)).toBe(1000)
      expect(readAuthEmailResponseFloorMs('  ')).toBe(1000)
      expect(readAuthEmailResponseFloorMs('0')).toBe(0)
      expect(readAuthEmailResponseFloorMs(' 1500 ')).toBe(1500)
      expect(readAuthEmailResponseFloorMs('5000')).toBe(5000)
    })

    it.each(['-1', '5001', '99999', '1.5', '1e3', 'abc', '0x10', '1000ms', '+100', 'NaN', 'Infinity'])('rejects %j at boot', (raw) => {
      expect(() => readAuthEmailResponseFloorMs(raw)).toThrow('AUTH_EMAIL_RESPONSE_FLOOR_MS')
      expect(() => new AuthService(prisma as any, jwt, { track: jest.fn() } as any, { get: (key: string) => (key === 'AUTH_EMAIL_RESPONSE_FLOOR_MS' ? raw : undefined) } as any))
        .toThrow('AUTH_EMAIL_RESPONSE_FLOOR_MS')
    })
  })

  describe('registration with a duplicate e-mail (current contract, decision pending)', () => {
    it('keeps 409 without creating anything; the per-e-mail limit bounds probing', async () => {
      const res = await http().post('/auth/register').send({ orgName: 'Org X', adminName: 'Admin X', email: 'active@org-a.test', password: 'Password123!' }).expect(409)
      expect(res.body.message).toBe('Email já cadastrado')
      expect(prisma.organization.create).not.toHaveBeenCalled()
      expect(prisma.user.create).not.toHaveBeenCalled()
      expect(JSON.stringify(res.body)).not.toMatch(/org-a|user-1|ADMIN/)
    })
  })
})
