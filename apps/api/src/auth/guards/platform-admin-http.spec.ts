import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { JwtAuthGuard } from './jwt-auth.guard'
import { RolesGuard } from './roles.guard'
import { PLATFORM_ADMIN_USER_IDS_ENV, PlatformAdminGuard, platformAdminUserIds } from './platform-admin.guard'
import { AdminCommercialController, CommercialController } from '../../commercial/commercial.controller'
import { CommercialPolicyService } from '../../common/commercial/commercial-policy.service'
import { PlansController } from '../../plans/plans.controller'
import { PlansService } from '../../plans/plans.service'

// Regression for C1: an organization ADMIN must not reach cross-tenant platform administration.
const USERS: Record<string, { userId: string; orgId: string; role: string }> = {
  adminA: { userId: 'user-admin-a', orgId: 'org-a', role: 'ADMIN' },
  adminB: { userId: 'user-admin-b', orgId: 'org-b', role: 'ADMIN' },
  managerA: { userId: 'user-manager-a', orgId: 'org-a', role: 'MANAGER' },
  platform: { userId: 'user-platform', orgId: 'org-platform', role: 'ADMIN' },
  demotedPlatform: { userId: 'user-platform-demoted', orgId: 'org-platform', role: 'MANAGER' },
}

describe('platform administration is isolated from organization ADMIN (C1)', () => {
  let app: INestApplication
  const previousAllowlist = process.env[PLATFORM_ADMIN_USER_IDS_ENV]

  const overview = { tenantCount: 2, nearLimitTenants: 0, blockedTenants: 0, tenants: [{ tenant: { id: 'org-a' } }, { tenant: { id: 'org-b' } }] }
  const commercial = {
    getAdminTenantCommercialOverview: jest.fn().mockResolvedValue(overview),
    upsertFeatureOverride: jest.fn().mockImplementation(async (orgId: string, featureKey: string, enabled: boolean) => ({ orgId, featureKey, enabled })),
    getContext: jest.fn().mockImplementation(async (orgId: string) => ({
      planName: 'STARTER', planDisplayName: `Plano ${orgId}`,
      subscription: { status: 'ACTIVE', currentPeriodStart: null, currentPeriodEnd: null },
      limits: {}, features: {}, featureOverrides: [],
    })),
  }
  const plans = {
    createPlan: jest.fn().mockResolvedValue({ id: 'plan', name: 'PRO' }),
    listPlans: jest.fn().mockResolvedValue([{ id: 'plan', name: 'PRO' }]),
  }

  const as = (key: keyof typeof USERS) => ({ 'x-test-user': key })
  const http = () => request(app.getHttpServer())

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [CommercialController, AdminCommercialController, PlansController],
      providers: [RolesGuard, PlatformAdminGuard,
        { provide: CommercialPolicyService, useValue: commercial },
        { provide: PlansService, useValue: plans },
      ],
    }).overrideGuard(JwtAuthGuard).useValue({ canActivate: (context: any) => {
      const req = context.switchToHttp().getRequest()
      const user = USERS[req.headers['x-test-user']]
      if (!user) return false
      req.user = { sub: user.userId, ...user }
      return true
    } }).compile()
    app = module.createNestApplication()
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
    await app.init()
  })

  afterAll(async () => {
    if (previousAllowlist === undefined) delete process.env[PLATFORM_ADMIN_USER_IDS_ENV]
    else process.env[PLATFORM_ADMIN_USER_IDS_ENV] = previousAllowlist
    await app?.close()
  })

  beforeEach(() => {
    jest.clearAllMocks()
    process.env[PLATFORM_ADMIN_USER_IDS_ENV] = 'user-platform, user-platform-demoted'
  })

  describe.each(['adminA', 'adminB', 'managerA'] as const)('organization user %s', (user) => {
    it('cannot list commercial data of every tenant', async () => {
      await http().get('/admin/commercial/tenants').set(as(user)).expect(403)
      expect(commercial.getAdminTenantCommercialOverview).not.toHaveBeenCalled()
    })

    it('cannot override features of another organization or its own', async () => {
      const otherOrg = USERS[user].orgId === 'org-a' ? 'org-b' : 'org-a'
      for (const orgId of [otherOrg, USERS[user].orgId]) {
        await http().patch(`/admin/commercial/tenants/${orgId}/features/whatsapp`).set(as(user)).send({ enabled: true }).expect(403)
      }
      expect(commercial.upsertFeatureOverride).not.toHaveBeenCalled()
    })

    it('cannot create global plans', async () => {
      await http().post('/plans').set(as(user)).send({ name: 'PRO', priceCents: 1 }).expect(403)
      expect(plans.createPlan).not.toHaveBeenCalled()
    })
  })

  it('denies a listed user who is no longer ADMIN', async () => {
    await http().get('/admin/commercial/tenants').set(as('demotedPlatform')).expect(403)
    await http().post('/plans').set(as('demotedPlatform')).send({ name: 'PRO', priceCents: 1 }).expect(403)
    expect(commercial.getAdminTenantCommercialOverview).not.toHaveBeenCalled()
    expect(plans.createPlan).not.toHaveBeenCalled()
  })

  it.each([undefined, '', ' , '])('denies everyone when the allowlist is %j (deny by default)', async (value) => {
    if (value === undefined) delete process.env[PLATFORM_ADMIN_USER_IDS_ENV]
    else process.env[PLATFORM_ADMIN_USER_IDS_ENV] = value
    await http().get('/admin/commercial/tenants').set(as('platform')).expect(403)
    await http().patch('/admin/commercial/tenants/org-a/features/whatsapp').set(as('platform')).send({ enabled: true }).expect(403)
    await http().post('/plans').set(as('platform')).send({ name: 'PRO', priceCents: 1 }).expect(403)
    expect(commercial.getAdminTenantCommercialOverview).not.toHaveBeenCalled()
    expect(commercial.upsertFeatureOverride).not.toHaveBeenCalled()
    expect(plans.createPlan).not.toHaveBeenCalled()
  })

  it('allows an allowlisted platform ADMIN to administer tenants and plans', async () => {
    const res = await http().get('/admin/commercial/tenants').set(as('platform')).expect(200)
    expect(res.body.data.tenantCount).toBe(2)
    await http().patch('/admin/commercial/tenants/org-b/features/whatsapp').set(as('platform')).send({ enabled: false, reason: 'suporte' }).expect(200)
    expect(commercial.upsertFeatureOverride).toHaveBeenCalledWith('org-b', 'whatsapp', false, 'suporte')
    await http().post('/plans').set(as('platform')).send({ name: 'PRO', priceCents: 1 }).expect(201)
    expect(plans.createPlan).toHaveBeenCalledTimes(1)
  })

  it('does not trust the organization id or role sent by the client', async () => {
    await http().get('/admin/commercial/tenants').set(as('adminA')).set('x-org-id', 'org-platform').set('x-user-role', 'PLATFORM_ADMIN').expect(403)
    expect(commercial.getAdminTenantCommercialOverview).not.toHaveBeenCalled()
  })

  it.each(['adminA', 'adminB'] as const)('keeps tenant-scoped commercial context working for %s', async (user) => {
    const res = await http().get('/commercial/context').set(as(user)).expect(200)
    expect(commercial.getContext).toHaveBeenCalledWith(USERS[user].orgId)
    expect(res.body.data.plan.name).toBe(`Plano ${USERS[user].orgId}`)
  })

  it('keeps the read-only plan catalog available to organization ADMIN', async () => {
    await http().get('/plans').set(as('adminA')).expect(200)
    expect(plans.listPlans).toHaveBeenCalledTimes(1)
  })

  it('parses the allowlist strictly', () => {
    expect([...platformAdminUserIds({ [PLATFORM_ADMIN_USER_IDS_ENV]: ' a, b\nc,,' } as any)]).toEqual(['a', 'b', 'c'])
    expect(platformAdminUserIds({} as any).size).toBe(0)
  })
})
