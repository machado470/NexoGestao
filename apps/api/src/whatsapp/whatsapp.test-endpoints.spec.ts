import { INestApplication, UnauthorizedException } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { areTestEndpointsEnabled } from '../common/config/test-endpoints'
import { TestEndpointsEnabledGuard, WhatsAppTestController } from './whatsapp.test.controller'
import { WhatsAppModule, whatsAppTestControllers } from './whatsapp.module'
import { WhatsAppService } from './whatsapp.service'

// Regression for C5: /whatsapp/test/* used to be registered whenever NODE_ENV !== 'production'
// (including staging-like and unset environments) and required no authentication at all, while
// taking the target orgId from the request body.
const ENV_KEYS = ['ENABLE_TEST_ENDPOINTS', 'NODE_ENV', 'RAILWAY_ENVIRONMENT_NAME', 'RAILWAY_ENVIRONMENT'] as const
const USERS: Record<string, { userId: string; orgId: string; role: string }> = {
  adminA: { userId: 'user-admin-a', orgId: 'org-a', role: 'ADMIN' },
  adminB: { userId: 'user-admin-b', orgId: 'org-b', role: 'ADMIN' },
  managerA: { userId: 'user-manager-a', orgId: 'org-a', role: 'MANAGER' },
  staffA: { userId: 'user-staff-a', orgId: 'org-a', role: 'STAFF' },
  viewerA: { userId: 'user-viewer-a', orgId: 'org-a', role: 'VIEWER' },
}
const message = { customerId: 'customer-1', toPhone: '+5511999999999', content: 'teste' }

type Env = Partial<Record<(typeof ENV_KEYS)[number], string>>
const ENVIRONMENTS: Array<[string, Env, boolean]> = [
  ['production with the flag enabled', { NODE_ENV: 'production', ENABLE_TEST_ENDPOINTS: 'true' }, false],
  ['production without the flag', { NODE_ENV: 'production' }, false],
  ['staging deployed with NODE_ENV=production and the flag enabled', { NODE_ENV: 'production', ENABLE_TEST_ENDPOINTS: 'true', RAILWAY_ENVIRONMENT_NAME: 'staging' }, false],
  ['Railway production environment with a wrong NODE_ENV and the flag', { NODE_ENV: 'development', ENABLE_TEST_ENDPOINTS: 'true', RAILWAY_ENVIRONMENT_NAME: 'production' }, false],
  ['legacy Railway variable naming production', { NODE_ENV: 'staging', ENABLE_TEST_ENDPOINTS: '1', RAILWAY_ENVIRONMENT: 'Production' }, false],
  ['unset NODE_ENV with the flag enabled', { ENABLE_TEST_ENDPOINTS: 'true' }, false],
  ['unknown NODE_ENV with the flag enabled', { NODE_ENV: 'prod', ENABLE_TEST_ENDPOINTS: 'true' }, false],
  ['staging without the flag', { NODE_ENV: 'staging', RAILWAY_ENVIRONMENT_NAME: 'staging' }, false],
  ['staging with the flag disabled explicitly', { NODE_ENV: 'staging', ENABLE_TEST_ENDPOINTS: 'false' }, false],
  ['staging with the flag enabled', { NODE_ENV: 'staging', ENABLE_TEST_ENDPOINTS: 'true', RAILWAY_ENVIRONMENT_NAME: 'staging' }, true],
  ['development without the flag (previously exposed)', { NODE_ENV: 'development' }, false],
  ['development with the flag set to 0', { NODE_ENV: 'development', ENABLE_TEST_ENDPOINTS: '0' }, false],
  ['development with the flag enabled', { NODE_ENV: 'development', ENABLE_TEST_ENDPOINTS: 'true' }, true],
  ['test with the flag enabled', { NODE_ENV: 'test', ENABLE_TEST_ENDPOINTS: 'yes' }, true],
]

describe('C5: WhatsApp test endpoints', () => {
  const previousEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]))
  const setEnv = (env: Env) => {
    for (const key of ENV_KEYS) {
      if (env[key] === undefined) delete process.env[key]
      else process.env[key] = env[key]
    }
  }
  afterAll(() => {
    for (const key of ENV_KEYS) {
      if (previousEnv[key] === undefined) delete process.env[key]
      else process.env[key] = previousEnv[key]
    }
  })

  describe('activation rule', () => {
    it.each(ENVIRONMENTS)('%s => enabled=%s', (_label, env, expected) => {
      expect(areTestEndpointsEnabled(env as NodeJS.ProcessEnv)).toBe(expected)
      expect(whatsAppTestControllers(env as NodeJS.ProcessEnv)).toEqual(expected ? [WhatsAppTestController] : [])
    })

    it('does not register the test controller by default (flag unset in this run)', () => {
      expect(previousEnv.ENABLE_TEST_ENDPOINTS ?? '').not.toMatch(/^(1|true|yes|on)$/i)
      const controllers: unknown[] = Reflect.getMetadata('controllers', WhatsAppModule) ?? []
      expect(controllers).not.toContain(WhatsAppTestController)
      expect(controllers.length).toBeGreaterThan(0)
    })
  })

  describe('HTTP behaviour', () => {
    let app: INestApplication
    const whatsapp = { queueMessage: jest.fn().mockResolvedValue({ id: 'message-1', status: 'QUEUED' }) }
    const as = (key: keyof typeof USERS) => ({ 'x-test-user': key })
    const post = (headers: Record<string, string> = {}, body: Record<string, unknown> = message) =>
      request(app.getHttpServer()).post('/whatsapp/test/queue').set(headers).send(body)

    beforeAll(async () => {
      const module = await Test.createTestingModule({
        controllers: [WhatsAppTestController],
        providers: [RolesGuard, TestEndpointsEnabledGuard, { provide: WhatsAppService, useValue: whatsapp }],
      }).overrideGuard(JwtAuthGuard).useValue({ canActivate: (context: any) => {
        const req = context.switchToHttp().getRequest()
        const user = USERS[req.headers['x-test-user']]
        if (!user) throw new UnauthorizedException()
        req.user = { sub: user.userId, ...user }
        return true
      } }).compile()
      app = module.createNestApplication()
      await app.init()
    })

    afterAll(async () => app?.close())
    beforeEach(() => jest.clearAllMocks())

    describe.each(ENVIRONMENTS.filter(([, , enabled]) => !enabled))('disabled: %s', (_label, env) => {
      it('answers 404 to everyone, before authentication, and queues nothing', async () => {
        setEnv(env)
        await post().expect(404)
        await post(as('adminA')).expect(404)
        await post(as('staffA')).expect(404)
        expect(whatsapp.queueMessage).not.toHaveBeenCalled()
      })
    })

    describe.each(ENVIRONMENTS.filter(([, , enabled]) => enabled))('enabled: %s', (_label, env) => {
      beforeEach(() => setEnv(env))

      it('rejects unauthenticated requests', async () => {
        await post().expect(401)
        await post({}, { ...message, orgId: 'org-a' }).expect(401)
        expect(whatsapp.queueMessage).not.toHaveBeenCalled()
      })

      it.each(['managerA', 'staffA', 'viewerA'] as const)('rejects non-admin user %s', async (user) => {
        await post(as(user)).expect(403)
        expect(whatsapp.queueMessage).not.toHaveBeenCalled()
      })

      it('lets an ADMIN queue only for their own organization (orgId from the session)', async () => {
        await post(as('adminA')).expect(201)
        expect(whatsapp.queueMessage).toHaveBeenCalledWith(expect.objectContaining({ orgId: 'org-a', customerId: 'customer-1', toPhone: '+5511999999999' }))
      })

      it.each([['orgId'], ['organizationId']])('rejects a payload targeting another organization via %s', async (field) => {
        await post(as('adminA'), { ...message, [field]: 'org-b' }).expect(403)
        expect(whatsapp.queueMessage).not.toHaveBeenCalled()
      })

      it('accepts a payload that repeats the admin own organization', async () => {
        await post(as('adminB'), { ...message, orgId: 'org-b' }).expect(201)
        expect(whatsapp.queueMessage).toHaveBeenCalledWith(expect.objectContaining({ orgId: 'org-b' }))
      })
    })

    it('stops serving immediately if the flag is turned off at runtime', async () => {
      setEnv({ NODE_ENV: 'development', ENABLE_TEST_ENDPOINTS: 'true' })
      await post(as('adminA')).expect(201)
      setEnv({ NODE_ENV: 'development', ENABLE_TEST_ENDPOINTS: 'false' })
      await post(as('adminA')).expect(404)
      expect(whatsapp.queueMessage).toHaveBeenCalledTimes(1)
    })
  })
})
