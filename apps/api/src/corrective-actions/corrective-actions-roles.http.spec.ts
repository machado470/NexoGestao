import { INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common'
import { GUARDS_METADATA } from '@nestjs/common/constants'
import { Test } from '@nestjs/testing'
import request from 'supertest'

import { AuditService } from '../audit/audit.service'
import { ROLES_KEY } from '../auth/decorators/roles.decorator'
import { RolesGuard } from '../auth/guards/roles.guard'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RequestContextService } from '../common/context/request-context.service'
import { TENANT_ACCESS_INTERCEPTOR_PROVIDER } from '../common/guards/tenant-access.guard'
import { ApiExceptionFilter } from '../common/http/api-exception.filter'
import { OperationalStateGuard } from '../people/operational-state.guard'
import { OperationalStateService } from '../people/operational-state.service'
import { PrismaService } from '../prisma/prisma.service'
import { RiskService } from '../risk/risk.service'
import { TimelineService } from '../timeline/timeline.service'
import { CorrectiveActionsController } from './corrective-actions.controller'
import { CorrectiveActionsService } from './corrective-actions.service'

/**
 * C8 PR3-3B-2 (CA-1, CA-2) — closing corrective actions.
 * Rule A: only ADMINs run POST /corrective-actions/:id/resolve and …/person/:personId/reassess.
 * Rule B: nobody closes a corrective action of their own person, ADMIN included.
 * Rule C: the author comes only from the session. Rule D: refusals have no service effects.
 */

const USERS = {
  adminA: { userId: 'u-admin-a', orgId: 'org-a', role: 'ADMIN', personId: 'p-admin-a' },
  managerA: { userId: 'u-manager-a', orgId: 'org-a', role: 'MANAGER', personId: 'p-manager-a' },
  staffA: { userId: 'u-staff-a', orgId: 'org-a', role: 'STAFF', personId: 'p-staff-a' },
  viewerA: { userId: 'u-viewer-a', orgId: 'org-a', role: 'VIEWER', personId: 'p-viewer-a' },
  adminB: { userId: 'u-admin-b', orgId: 'org-b', role: 'ADMIN', personId: 'p-admin-b' },
  adminNoPerson: { userId: 'u-admin-np', orgId: 'org-a', role: 'ADMIN', personId: undefined },
  adminNoUser: { userId: undefined, orgId: 'org-a', role: 'ADMIN', personId: 'p-admin-x' },
} as const
type UserKey = keyof typeof USERS
const NON_ADMIN: UserKey[] = ['managerA', 'staffA', 'viewerA']

const PERSON_ORG: Record<string, string> = { 'p-admin-a': 'org-a', 'p-staff-a': 'org-a', 'p-viewer-a': 'org-a', 'p-admin-b': 'org-b' }

type Action = { id: string; personId: string; reason: string; status: string; createdAt: Date; resolvedAt: Date | null }
let actions: Action[]
let audits: any[]

function reset() {
  const at = (d: number) => new Date(`2026-11-${10 + d}T00:00:00.000Z`)
  actions = [
    { id: 'ca-staff', personId: 'p-staff-a', reason: 'Risco crítico identificado em avaliação', status: 'OPEN', createdAt: at(1), resolvedAt: null },
    { id: 'ca-viewer', personId: 'p-viewer-a', reason: 'Governança', status: 'OPEN', createdAt: at(2), resolvedAt: null },
    { id: 'ca-admin', personId: 'p-admin-a', reason: 'Governança', status: 'OPEN', createdAt: at(3), resolvedAt: null },
    { id: 'ca-b', personId: 'p-admin-b', reason: 'Governança', status: 'OPEN', createdAt: at(4), resolvedAt: null },
  ]
  audits = []
}

const inOrg = (a: Action, where: any) => !where?.person?.orgId || PERSON_ORG[a.personId] === where.person.orgId
const matches = (a: Action, where: any) =>
  (where.id === undefined || a.id === where.id) &&
  (where.personId === undefined || a.personId === where.personId) &&
  (where.status === undefined || a.status === where.status) &&
  inOrg(a, where)

const prisma: any = {
  correctiveAction: {
    findFirst: jest.fn(async ({ where, orderBy }: any) => {
      const found = actions.filter((a) => matches(a, where))
      if (orderBy?.createdAt === 'desc') found.sort((x, y) => y.createdAt.getTime() - x.createdAt.getTime())
      return found[0] ? { ...found[0] } : null
    }),
    findMany: jest.fn(async ({ where }: any) => actions.filter((a) => matches(a, where)).map((a) => ({ ...a }))),
    updateMany: jest.fn(async ({ where, data }: any) => {
      const found = actions.filter((a) => matches(a, where))
      found.forEach((a) => Object.assign(a, data))
      return { count: found.length }
    }),
  },
  person: { findFirst: jest.fn(async ({ where }: any) => (PERSON_ORG[where.id] === where.orgId ? { orgId: where.orgId } : null)) },
  auditEvent: { create: jest.fn(async ({ data }: any) => { audits.push(data); return { id: `audit-${audits.length}`, ...data } }) },
  // Interactive transaction: the callback runs against the same in-memory delegates.
  $transaction: jest.fn(async (fn: any) => fn(prisma)),
}
const allPrismaMocks = () =>
  Object.values(prisma).flatMap((delegate: any) => (typeof delegate === 'function' ? [delegate] : Object.values(delegate))) as jest.Mock[]

const risk = { recalculatePersonRisk: jest.fn().mockResolvedValue({ score: 10, state: 'NORMAL' }) }
const timeline = { log: jest.fn().mockResolvedValue(undefined) }
const operationalState = { getStatus: jest.fn().mockResolvedValue({ state: 'NORMAL', riskScore: 10 }) }
const requestContext = { requestId: 'req-1', userId: 'u-from-cls', personId: 'p-from-cls' }

describe('C8 PR3-3B-2: closing corrective actions (ADMIN only, never one’s own, author from the session)', () => {
  let app: INestApplication
  const http = () => request(app.getHttpServer())
  const post = (user: UserKey | undefined, path: string, body?: object) => {
    const req = http().post(path)
    if (user) req.set('x-test-user', user)
    return body ? req.send(body) : req
  }

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [CorrectiveActionsController],
      providers: [
        TENANT_ACCESS_INTERCEPTOR_PROVIDER,
        CorrectiveActionsService,
        AuditService,
        RolesGuard,
        OperationalStateGuard,
        { provide: PrismaService, useValue: prisma },
        { provide: RiskService, useValue: risk },
        { provide: TimelineService, useValue: timeline },
        { provide: OperationalStateService, useValue: operationalState },
        { provide: RequestContextService, useValue: requestContext },
      ],
    })
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
  afterAll(async () => app?.close())
  beforeEach(() => {
    reset()
    jest.clearAllMocks()
    operationalState.getStatus.mockReset().mockResolvedValue({ state: 'NORMAL', riskScore: 10 })
  })

  /** Rule D: nothing closed, no resolvedAt, no risk recalculation, no closing timeline or audit. */
  function expectNoEffects() {
    expect(prisma.correctiveAction.updateMany).not.toHaveBeenCalled()
    expect(actions.every((a) => a.status === 'OPEN' && a.resolvedAt === null)).toBe(true)
    expect(risk.recalculatePersonRisk).not.toHaveBeenCalled()
    expect(timeline.log).not.toHaveBeenCalled()
    expect(prisma.auditEvent.create).not.toHaveBeenCalled()
  }

  const ROUTES = {
    resolve: (id: string) => `/corrective-actions/${id}/resolve`,
    reassess: (personId: string) => `/corrective-actions/person/${personId}/reassess`,
  }

  describe('rule A — only ADMIN', () => {
    it('an ADMIN resolves an action of another person of the organization', async () => {
      const res = await post('adminA', ROUTES.resolve('ca-staff')).expect(201)
      expect(res.body).toMatchObject({ id: 'ca-staff', status: 'DONE', personId: 'p-staff-a' })
      expect(actions.find((a) => a.id === 'ca-staff')).toMatchObject({ status: 'DONE', resolvedAt: expect.any(Date) })
      expect(risk.recalculatePersonRisk).toHaveBeenCalledWith('p-staff-a', expect.stringContaining('Corretiva resolvida'))
      expect(timeline.log).toHaveBeenCalledWith(expect.objectContaining({ orgId: 'org-a', action: 'CORRECTIVE_ACTION_RESOLVED', personId: 'p-staff-a' }))
    })

    it('an ADMIN reassesses another person (closes their latest OPEN action, existing semantics)', async () => {
      actions.push({ id: 'ca-staff-older', personId: 'p-staff-a', reason: 'Antiga', status: 'OPEN', createdAt: new Date('2026-11-01T00:00:00.000Z'), resolvedAt: null })
      const res = await post('adminA', ROUTES.reassess('p-staff-a')).expect(201)
      expect(res.body).toEqual({ reassessed: true, resolved: true, correctiveActionId: 'ca-staff' })
      expect(actions.find((a) => a.id === 'ca-staff')!.status).toBe('DONE')
      expect(actions.find((a) => a.id === 'ca-staff-older')!.status).toBe('OPEN')
    })

    for (const user of NON_ADMIN) {
      it(`${user} gets 403 on resolve and reassess before any database access, with no effects`, async () => {
        await post(user, ROUTES.resolve('ca-viewer')).expect(403)
        await post(user, ROUTES.reassess('p-viewer-a')).expect(403)
        await post(user, ROUTES.resolve(user === 'staffA' ? 'ca-staff' : 'ca-viewer')).expect(403)
        for (const mock of allPrismaMocks()) expect(mock).not.toHaveBeenCalled()
        expect(operationalState.getStatus).not.toHaveBeenCalled()
        expectNoEffects()
      })
    }

    it('unauthenticated requests get 401 with no effects', async () => {
      await post(undefined, ROUTES.resolve('ca-staff')).expect(401)
      await post(undefined, ROUTES.reassess('p-staff-a')).expect(401)
      for (const mock of allPrismaMocks()) expect(mock).not.toHaveBeenCalled()
      expectNoEffects()
    })
  })

  describe('rule B — no self-resolution', () => {
    it('an ADMIN resolving their own action gets 403 with no effects', async () => {
      const res = await post('adminA', ROUTES.resolve('ca-admin')).expect(403)
      expect(res.body.error).toBe('Não é permitido encerrar uma ação corretiva própria.')
      expectNoEffects()
    })

    it('an ADMIN reassessing their own person gets 403 before any lookup, with no effects', async () => {
      const res = await post('adminA', ROUTES.reassess('p-admin-a')).expect(403)
      expect(res.body.error).toBe('Não é permitido encerrar uma ação corretiva própria.')
      expect(prisma.correctiveAction.findFirst).not.toHaveBeenCalled()
      expectNoEffects()
    })

    it.each(['adminNoPerson', 'adminNoUser'] as UserKey[])('%s (session identity not verifiable) is denied before any lookup', async (user) => {
      await post(user, ROUTES.resolve('ca-staff')).expect(403)
      await post(user, ROUTES.reassess('p-staff-a')).expect(403)
      for (const mock of allPrismaMocks()) expect(mock).not.toHaveBeenCalled()
      expectNoEffects()
    })
  })

  describe('organization isolation (existing contract kept: no difference between missing and foreign)', () => {
    it('resolve: a missing id and an id of another organization give the same answer and change nothing', async () => {
      const foreign = await post('adminA', ROUTES.resolve('ca-b')).expect(201)
      const missing = await post('adminA', ROUTES.resolve('ca-missing')).expect(201)
      expect(foreign.body).toEqual(missing.body)
      expect(foreign.text).toBe('')
      expect(actions.find((a) => a.id === 'ca-b')).toMatchObject({ status: 'OPEN', resolvedAt: null })
      expectNoEffects()
    })

    it('reassess: a person of another organization and a missing person give the same answer and change nothing', async () => {
      const foreign = await post('adminA', ROUTES.reassess('p-admin-b')).expect(201)
      const missing = await post('adminA', ROUTES.reassess('p-missing')).expect(201)
      expect(foreign.body).toEqual({ reassessed: true, resolved: false })
      expect(missing.body).toEqual(foreign.body)
      expectNoEffects()
    })

    it('an ADMIN of org-b cannot close an action of org-a', async () => {
      await post('adminB', ROUTES.resolve('ca-staff')).expect(201, '')
      await post('adminB', ROUTES.reassess('p-staff-a')).expect(201, { reassessed: true, resolved: false })
      expectNoEffects()
    })
  })

  describe('rule C — author from the session only', () => {
    it('the closing audit records the session author, organization and entity', async () => {
      await post('adminA', ROUTES.resolve('ca-staff')).expect(201)
      expect(audits).toEqual([
        expect.objectContaining({
          orgId: 'org-a',
          action: 'CORRECTIVE_ACTION_RESOLVED',
          actorUserId: 'u-admin-a',
          actorPersonId: 'p-admin-a',
          entityType: 'CORRECTIVE_ACTION',
          entityId: 'ca-staff',
          context: 'Ação corretiva resolvida',
          metadata: { requestId: 'req-1', personId: 'p-staff-a' },
        }),
      ])
      expect(JSON.stringify(audits)).not.toContain('from-cls')
    })

    it('reassess audits the same way', async () => {
      await post('adminA', ROUTES.reassess('p-staff-a')).expect(201)
      expect(audits).toEqual([expect.objectContaining({ action: 'CORRECTIVE_ACTION_RESOLVED', actorUserId: 'u-admin-a', actorPersonId: 'p-admin-a', entityId: 'ca-staff' })])
    })

    it('identity or role fields in the body change neither authorization nor authorship', async () => {
      // A STAFF claiming ADMIN, and an ADMIN claiming to be someone else on their own action, are refused.
      await post('staffA', ROUTES.resolve('ca-viewer'), { role: 'ADMIN', userId: 'u-admin-a', personId: 'p-admin-a' }).expect(403)
      await post('adminA', ROUTES.resolve('ca-admin'), { personId: 'p-staff-a', actorPersonId: 'p-staff-a', actorUserId: 'u-staff-a' }).expect(403)
      await post('adminA', ROUTES.reassess('p-admin-a'), { personId: 'p-staff-a', role: 'VIEWER' }).expect(403)
      expectNoEffects()
      // An accepted request with forged fields: the audit holds the session identity.
      await post('adminA', ROUTES.resolve('ca-staff'), { actorUserId: 'u-forged', actorPersonId: 'p-forged', role: 'VIEWER' }).expect(201)
      expect(audits[0]).toMatchObject({ actorUserId: 'u-admin-a', actorPersonId: 'p-admin-a' })
      expect(JSON.stringify(audits)).not.toContain('forged')
    })

    it('a client orgId of another organization is refused (403) with no effects', async () => {
      await post('adminA', `${ROUTES.resolve('ca-staff')}?orgId=org-b`).expect(403)
      await post('adminA', ROUTES.reassess('p-staff-a'), { orgId: 'org-b' }).expect(403)
      expectNoEffects()
    })
  })

  // C8 PR3-3B-3 (CA-4): only an OPEN action is closed, once.
  describe('idempotent closing (CA-4)', () => {
    it('the conditional update requires status OPEN within the organization', async () => {
      await post('adminA', ROUTES.resolve('ca-staff')).expect(201)
      expect(prisma.correctiveAction.updateMany).toHaveBeenCalledWith({
        where: { id: 'ca-staff', person: { orgId: 'org-a' }, status: 'OPEN' },
        data: { status: 'DONE', resolvedAt: expect.any(Date) },
      })
    })

    it('a second resolve keeps resolvedAt and has no recalculation, timeline or audit', async () => {
      await post('adminA', ROUTES.resolve('ca-staff')).expect(201)
      const firstResolvedAt = actions.find((a) => a.id === 'ca-staff')!.resolvedAt
      jest.clearAllMocks()
      audits.length = 0
      const again = await post('adminA', ROUTES.resolve('ca-staff')).expect(201)
      expect(again.text).toBe('')
      expect(actions.find((a) => a.id === 'ca-staff')!.resolvedAt).toBe(firstResolvedAt)
      expect(risk.recalculatePersonRisk).not.toHaveBeenCalled()
      expect(timeline.log).not.toHaveBeenCalled()
      expect(prisma.auditEvent.create).not.toHaveBeenCalled()
    })

    it.each(['DONE', 'AWAITING_REASSESSMENT'])('an action in %s is not closed and produces no effect', async (status) => {
      const target = actions.find((a) => a.id === 'ca-staff')!
      target.status = status
      await post('adminA', ROUTES.resolve('ca-staff')).expect(201, '')
      expect(target).toMatchObject({ status, resolvedAt: null })
      expect(risk.recalculatePersonRisk).not.toHaveBeenCalled()
      expect(timeline.log).not.toHaveBeenCalled()
      expect(prisma.auditEvent.create).not.toHaveBeenCalled()
    })

    it('the update and its audit run in one transaction; an audit failure propagates (500) with no recalculation or timeline', async () => {
      prisma.auditEvent.create.mockRejectedValueOnce(new Error('simulated audit storage failure'))
      const res = await post('adminA', ROUTES.resolve('ca-staff')).expect(500)
      expect(res.body).toMatchObject({ code: 'INTERNAL_ERROR' })
      expect(prisma.$transaction).toHaveBeenCalledTimes(1)
      expect(risk.recalculatePersonRisk).not.toHaveBeenCalled()
      expect(timeline.log).not.toHaveBeenCalled()
      // The real rollback (action stays OPEN) is proven against PostgreSQL in the idempotency spec.
    })

    it('if the updated action cannot be re-read inside the transaction, the transaction fails (no silent null, no audit)', async () => {
      prisma.correctiveAction.findFirst
        .mockImplementationOnce(async ({ where }: any) => ({ ...actions.find((a) => matches(a, where))! })) // pre-check
        .mockResolvedValueOnce(null) // re-read inside the transaction, after updateMany.count = 1
      const res = await post('adminA', ROUTES.resolve('ca-staff')).expect(500)
      expect(res.body).toMatchObject({ code: 'INTERNAL_ERROR' })
      expect(prisma.correctiveAction.updateMany).toHaveReturnedTimes(1)
      expect(await prisma.correctiveAction.updateMany.mock.results[0].value).toEqual({ count: 1 })
      expect(prisma.auditEvent.create).not.toHaveBeenCalled()
      expect(risk.recalculatePersonRisk).not.toHaveBeenCalled()
      expect(timeline.log).not.toHaveBeenCalled()
      // The real rollback (action stays OPEN) is proven against PostgreSQL in the idempotency spec.
    })

    it('a repeated reassess closes the next OPEN action and then reports resolved: false', async () => {
      await post('adminA', ROUTES.reassess('p-staff-a')).expect(201, { reassessed: true, resolved: true, correctiveActionId: 'ca-staff' })
      await post('adminA', ROUTES.reassess('p-staff-a')).expect(201, { reassessed: true, resolved: false })
      expect(audits).toHaveLength(1)
    })
  })

  describe('guards and existing behavior', () => {
    it('JwtAuthGuard → RolesGuard on the class, @Roles(ADMIN) and OperationalStateGuard on both closing routes', () => {
      const proto = CorrectiveActionsController.prototype
      expect(Reflect.getMetadata(GUARDS_METADATA, CorrectiveActionsController)).toEqual([JwtAuthGuard, RolesGuard])
      for (const handler of [proto.resolve, proto.processReassessment]) {
        expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual(['ADMIN'])
        expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toEqual([OperationalStateGuard])
      }
      // The GET keeps its current access (privacy is PR3-5).
      expect(Reflect.getMetadata(ROLES_KEY, proto.listByPerson)).toBeUndefined()
    })

    it('GET /corrective-actions/person/:personId keeps its current access for any authenticated role', async () => {
      for (const user of ['adminA', 'managerA', 'staffA', 'viewerA'] as UserKey[]) {
        const res = await http().get('/corrective-actions/person/p-staff-a').set('x-test-user', user).expect(200)
        expect(res.body).toEqual([expect.objectContaining({ id: 'ca-staff' })])
      }
      await http().get('/corrective-actions/person/p-staff-a').expect(401)
    })

    it('an ADMIN is not operationally blocked (existing bypass): SUSPENDED/RESTRICTED state is not read', async () => {
      operationalState.getStatus.mockResolvedValue({ state: 'SUSPENDED', riskScore: 99 })
      await post('adminA', ROUTES.resolve('ca-staff')).expect(201)
      // getStatus is read once by the service after closing, never by the guard for an ADMIN.
      expect(operationalState.getStatus).toHaveBeenCalledTimes(1)
      expect(operationalState.getStatus).toHaveBeenCalledWith('p-staff-a')
    })
  })
})
