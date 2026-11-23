import { INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common'
import { GUARDS_METADATA } from '@nestjs/common/constants'
import { Test } from '@nestjs/testing'
import request from 'supertest'

import { OperationalStateAdminController } from '../admin/operational-state.admin.controller'
import { AdminOverviewController } from '../admin/admin-overview.controller'
import { ROLES_KEY } from '../auth/decorators/roles.decorator'
import { RolesGuard } from '../auth/guards/roles.guard'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { TENANT_ACCESS_INTERCEPTOR_PROVIDER } from '../common/guards/tenant-access.guard'
import { ApiExceptionFilter } from '../common/http/api-exception.filter'
import { PrismaService } from '../prisma/prisma.service'
import { EnforcementController } from './enforcement.controller'
import { EnforcementEngineService } from './enforcement-engine.service'
import { GovernanceRunService } from './governance-run.service'

/**
 * C8 PR3-3B-6 — POST /admin/enforcement/run-once runs the enforcement engine for the caller's
 * organization. It only had JwtAuthGuard: with ALLOW_MANUAL_ENFORCEMENT on, any role (VIEWER
 * included) could run it. Now JwtAuthGuard → RolesGuard with @Roles('ADMIN').
 */

const USERS = {
  adminA: { userId: 'u-admin-a', orgId: 'org-a', role: 'ADMIN', personId: 'p-admin-a' },
  managerA: { userId: 'u-manager-a', orgId: 'org-a', role: 'MANAGER', personId: 'p-manager-a' },
  staffA: { userId: 'u-staff-a', orgId: 'org-a', role: 'STAFF', personId: 'p-staff-a' }, // collaborator
  viewerA: { userId: 'u-viewer-a', orgId: 'org-a', role: 'VIEWER', personId: 'p-viewer-a' },
  operadorA: { userId: 'u-op-a', orgId: 'org-a', role: 'OPERADOR', personId: 'p-op-a' },
  financeiroA: { userId: 'u-fin-a', orgId: 'org-a', role: 'FINANCEIRO', personId: 'p-fin-a' },
  noRoleA: { userId: 'u-norole-a', orgId: 'org-a', role: undefined, personId: 'p-norole-a' },
  adminB: { userId: 'u-admin-b', orgId: 'org-b', role: 'ADMIN', personId: 'p-admin-b' },
} as const
type UserKey = keyof typeof USERS
const NON_ADMIN: UserKey[] = ['managerA', 'staffA', 'viewerA', 'operadorA', 'financeiroA', 'noRoleA']

const engineResult = { evaluated: 3, warnings: 1, correctivesCreated: 1, restrictedCount: 1, suspendedCount: 0 }
const engine = { runForOrg: jest.fn(async () => engineResult) }
const runService = {
  startRun: jest.fn(async () => undefined),
  finishWithAggregates: jest.fn(async (params: any) => ({ id: `run-${params.orgId}`, orgId: params.orgId })),
}
const prisma: any = {
  person: { aggregate: jest.fn(async () => ({ _avg: { operationalRiskScore: 42.4 } })) },
  correctiveAction: { count: jest.fn(async () => 2) },
}
const effects = () => [engine.runForOrg, runService.startRun, runService.finishWithAggregates, prisma.person.aggregate, prisma.correctiveAction.count]

describe('C8 PR3-3B-6: POST /admin/enforcement/run-once is ADMIN-only', () => {
  let app: INestApplication
  const previousFlag = process.env.ALLOW_MANUAL_ENFORCEMENT
  const run = (user?: UserKey, path = '/admin/enforcement/run-once', body?: object) => {
    const req = request(app.getHttpServer()).post(path)
    if (user) req.set('x-test-user', user)
    return body ? req.send(body) : req
  }

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [EnforcementController],
      providers: [
        TENANT_ACCESS_INTERCEPTOR_PROVIDER,
        RolesGuard,
        { provide: EnforcementEngineService, useValue: engine },
        { provide: GovernanceRunService, useValue: runService },
        { provide: PrismaService, useValue: prisma },
      ],
    })
      // Persisted-session validation (invalid or revoked tokens) is exercised for real in the PostgreSQL spec.
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: any) => {
          const req = context.switchToHttp().getRequest()
          const user = (USERS as Record<string, (typeof USERS)[UserKey]>)[req.headers['x-test-user']]
          if (!user) throw new UnauthorizedException()
          req.user = { sub: user.userId, ...user }
          return true
        },
      })
      .compile()
    app = module.createNestApplication()
    app.useGlobalFilters(new ApiExceptionFilter())
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
    await app.init()
  })
  afterAll(async () => {
    if (previousFlag === undefined) delete process.env.ALLOW_MANUAL_ENFORCEMENT
    else process.env.ALLOW_MANUAL_ENFORCEMENT = previousFlag
    await app?.close()
  })
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.ALLOW_MANUAL_ENFORCEMENT = 'true'
  })

  const expectNoEffects = () => {
    for (const fn of effects()) expect(fn).not.toHaveBeenCalled()
  }

  describe('A — ADMIN with the flag on', () => {
    it('runs the engine for the session organization and keeps the response contract', async () => {
      const res = await run('adminA').expect(201)
      expect(res.body).toEqual({ ok: true, data: { engine: engineResult, run: { id: 'run-org-a', orgId: 'org-a' } } })
      expect(runService.startRun).toHaveBeenCalledWith('org-a')
      expect(engine.runForOrg).toHaveBeenCalledWith('org-a')
      expect(prisma.person.aggregate).toHaveBeenCalledWith({ where: { orgId: 'org-a', active: true }, _avg: { operationalRiskScore: true } })
      expect(prisma.correctiveAction.count).toHaveBeenCalledWith({ where: { status: 'OPEN', person: { orgId: 'org-a' } } })
      expect(runService.finishWithAggregates).toHaveBeenCalledWith({
        orgId: 'org-a',
        evaluated: 3,
        warnings: 1,
        correctives: 1,
        institutionalRiskScore: 42,
        restrictedCount: 1,
        suspendedCount: 0,
        openCorrectivesCount: 2,
      })
    })
  })

  describe('B/C — non-admin roles with the flag on', () => {
    it.each(NON_ADMIN)('%s gets 403 by role and the engine never runs', async (user) => {
      const res = await run(user).expect(403)
      expect(res.body.error).toMatch(/Sem permissão/)
      expectNoEffects()
    })
  })

  describe('D/E — no or invalid authentication', () => {
    it('no credentials: 401 and no effect', async () => {
      await run().expect(401)
      expectNoEffects()
    })

    it('an unknown session: 401 and no effect', async () => {
      await request(app.getHttpServer()).post('/admin/enforcement/run-once').set('x-test-user', 'forged').expect(401)
      expectNoEffects()
    })
  })

  describe('F — flag disabled', () => {
    it.each(['false', '0', '', undefined])('ALLOW_MANUAL_ENFORCEMENT=%p: ADMIN keeps the existing 403 contract and nothing runs', async (value) => {
      if (value === undefined) delete process.env.ALLOW_MANUAL_ENFORCEMENT
      else process.env.ALLOW_MANUAL_ENFORCEMENT = value
      const res = await run('adminA').expect(403)
      expect(res.body.error).toBe('Manual enforcement desabilitado.')
      expectNoEffects()
    })

    it('a non-admin with the flag disabled is refused by role first (still 403, nothing runs)', async () => {
      process.env.ALLOW_MANUAL_ENFORCEMENT = 'false'
      const res = await run('viewerA').expect(403)
      expect(res.body.error).toMatch(/Sem permissão/)
      expectNoEffects()
    })
  })

  describe('G — organization isolation', () => {
    it('an ADMIN of org-b runs only org-b', async () => {
      await run('adminB').expect(201)
      expect(engine.runForOrg).toHaveBeenCalledWith('org-b')
      expect(engine.runForOrg).not.toHaveBeenCalledWith('org-a')
    })

    it('a client orgId of another organization (query or body) is refused before the engine runs', async () => {
      await run('adminA', '/admin/enforcement/run-once?orgId=org-b').expect(403)
      await run('adminA', '/admin/enforcement/run-once', { orgId: 'org-b' }).expect(403)
      await run('adminA', '/admin/enforcement/run-once', { organizationId: 'org-b' }).expect(403)
      expectNoEffects()
    })

    it('a client orgId equal to the session organization changes nothing: the session organization is used', async () => {
      await run('adminA', '/admin/enforcement/run-once?orgId=org-a').expect(201)
      expect(engine.runForOrg).toHaveBeenCalledWith('org-a')
    })
  })

  describe('H — structure and other admin routes', () => {
    it('EnforcementController: JwtAuthGuard → RolesGuard on the class and @Roles(ADMIN) on run-once', () => {
      expect(Reflect.getMetadata(GUARDS_METADATA, EnforcementController)).toEqual([JwtAuthGuard, RolesGuard])
      expect(Reflect.getMetadata(ROLES_KEY, EnforcementController.prototype.runOnce)).toEqual(['ADMIN'])
    })

    it('the other admin controllers keep their ADMIN protection', () => {
      expect(Reflect.getMetadata(GUARDS_METADATA, OperationalStateAdminController)).toEqual([JwtAuthGuard, RolesGuard])
      expect(Reflect.getMetadata(ROLES_KEY, OperationalStateAdminController)).toEqual(['ADMIN'])
      expect(Reflect.getMetadata(GUARDS_METADATA, AdminOverviewController)).toEqual([JwtAuthGuard, RolesGuard])
    })
  })
})
