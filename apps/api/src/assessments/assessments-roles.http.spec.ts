import { INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common'
import { GUARDS_METADATA } from '@nestjs/common/constants'
import { Test } from '@nestjs/testing'
import request from 'supertest'

import { AuditService } from '../audit/audit.service'
import { ROLES_KEY } from '../auth/decorators/roles.decorator'
import { RolesGuard } from '../auth/guards/roles.guard'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { TENANT_ACCESS_INTERCEPTOR_PROVIDER } from '../common/guards/tenant-access.guard'
import { ApiExceptionFilter } from '../common/http/api-exception.filter'
import { CorrectiveActionsService } from '../corrective-actions/corrective-actions.service'
import { OperationalStateGuard } from '../people/operational-state.guard'
import { OperationalStateService } from '../people/operational-state.service'
import { PrismaService } from '../prisma/prisma.service'
import { RiskService } from '../risk/risk.service'
import { TimelineService } from '../timeline/timeline.service'
import { AssessmentsController } from './assessments.controller'
import { AssessmentsService } from './assessments.service'

/**
 * C8 PR3-3A — POST /assessments: only organization ADMINs submit assessments (rule A), nobody
 * evaluates their own assignment, ADMIN included (rule B), and every accepted assessment records
 * its author from the session in the audit trail (rule C).
 */

const USERS = {
  adminA: { userId: 'u-admin-a', orgId: 'org-a', role: 'ADMIN', personId: 'person-admin-a' },
  managerA: { userId: 'u-manager-a', orgId: 'org-a', role: 'MANAGER', personId: 'person-manager-a' },
  staffA: { userId: 'u-staff-a', orgId: 'org-a', role: 'STAFF', personId: 'person-staff-a' },
  viewerA: { userId: 'u-viewer-a', orgId: 'org-a', role: 'VIEWER', personId: 'person-viewer-a' },
  adminB: { userId: 'u-admin-b', orgId: 'org-b', role: 'ADMIN', personId: 'person-admin-b' },
  adminNoPerson: { userId: 'u-admin-np', orgId: 'org-a', role: 'ADMIN', personId: undefined },
  adminNoUser: { userId: undefined, orgId: 'org-a', role: 'ADMIN', personId: 'person-admin-x' },
} as const
type UserKey = keyof typeof USERS
const NON_ADMIN: UserKey[] = ['managerA', 'staffA', 'viewerA']

const PERSON_ORG: Record<string, string> = {
  'person-admin-a': 'org-a',
  'person-staff-a': 'org-a',
  'person-viewer-a': 'org-a',
  'person-b': 'org-b',
}

type Assignment = { id: string; personId: string; trackId: string; progress: number; risk: string }
let assignments: Assignment[]
let assessments: any[]
let correctives: any[]
let audits: any[]

function reset() {
  assignments = [
    { id: 'asg-staff', personId: 'person-staff-a', trackId: 'track-a', progress: 100, risk: 'LOW' },
    { id: 'asg-viewer', personId: 'person-viewer-a', trackId: 'track-a', progress: 100, risk: 'LOW' },
    { id: 'asg-admin-own', personId: 'person-admin-a', trackId: 'track-a', progress: 100, risk: 'LOW' },
    { id: 'asg-b', personId: 'person-b', trackId: 'track-b', progress: 100, risk: 'LOW' },
  ]
  assessments = []
  correctives = []
  audits = []
}

const prisma: any = {
  assignment: {
    findFirst: jest.fn(async ({ where }: any) => {
      const a = assignments.find((x) => x.id === where.id && (!where.person?.orgId || PERSON_ORG[x.personId] === where.person.orgId))
      return a ? { ...a, person: { id: a.personId, orgId: PERSON_ORG[a.personId] }, track: { id: a.trackId, title: `Trilha ${a.trackId}` } } : null
    }),
    update: jest.fn(async ({ where, data }: any) => {
      const a = assignments.find((x) => x.id === where.id)!
      Object.assign(a, data)
      return { ...a }
    }),
  },
  assessment: {
    create: jest.fn(async ({ data }: any) => {
      const created = { id: `assessment-${assessments.length + 1}`, createdAt: new Date('2026-11-22T00:00:00.000Z'), notes: null, ...data }
      assessments.push(created)
      return created
    }),
  },
  correctiveAction: {
    findFirst: jest.fn(async ({ where }: any) => correctives.find((c) => c.personId === where.personId && c.status === 'OPEN' && c.reason === where.reason) ?? null),
    create: jest.fn(async ({ data }: any) => {
      const created = { id: `corrective-${correctives.length + 1}`, ...data }
      correctives.push(created)
      return created
    }),
  },
  auditEvent: {
    create: jest.fn(async ({ data }: any) => {
      audits.push(data)
      return { id: `audit-${audits.length}`, ...data }
    }),
  },
  person: {
    findUnique: jest.fn(async ({ where }: any) => (PERSON_ORG[where.id] ? { orgId: PERSON_ORG[where.id] } : null)),
    // Person check inside the atomic corrective-action creation (C8 PR3-3B-5).
    findFirst: jest.fn(async ({ where }: any) => (PERSON_ORG[where.id] === where.orgId ? { id: where.id } : null)),
  },
  // Transactional advisory lock + interactive transaction over the same in-memory delegates.
  $queryRaw: jest.fn(async () => [{ locked: 1 }]),
  $transaction: jest.fn(async (fn: any) => fn(prisma)),
}
const allPrismaMocks = () =>
  Object.values(prisma).flatMap((delegate: any) => (typeof delegate === 'function' ? [delegate] : Object.values(delegate))) as jest.Mock[]

const risk = { recalculatePersonRisk: jest.fn().mockResolvedValue(10) }
const timeline = { log: jest.fn().mockResolvedValue(undefined) }
const operationalState = { getStatus: jest.fn().mockResolvedValue({ state: 'NORMAL', riskScore: 0 }) }

describe('C8 PR3-3A: POST /assessments authorization, self-assessment and authorship', () => {
  let app: INestApplication
  const http = () => request(app.getHttpServer())
  const submit = (user: UserKey | undefined, body: object) => {
    const req = http().post('/assessments')
    if (user) req.set('x-test-user', user)
    return req.send(body)
  }

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AssessmentsController],
      providers: [
        TENANT_ACCESS_INTERCEPTOR_PROVIDER,
        AssessmentsService,
        AuditService,
        RolesGuard,
        OperationalStateGuard,
        { provide: PrismaService, useValue: prisma },
        { provide: RiskService, useValue: risk },
        { provide: TimelineService, useValue: timeline },
        { provide: OperationalStateService, useValue: operationalState },
        { provide: CorrectiveActionsService, useValue: {} },
      ],
    })
      // Session validation itself is exercised for real in the PostgreSQL spec.
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
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, transformOptions: { enableImplicitConversion: true } }))
    await app.init()
  })
  afterAll(async () => app?.close())
  beforeEach(() => {
    reset()
    jest.clearAllMocks()
    operationalState.getStatus.mockReset().mockResolvedValue({ state: 'NORMAL', riskScore: 0 })
  })

  /** A refused request writes nothing and triggers no event, audit or risk recalculation. */
  function expectNoEffects() {
    expect(prisma.assessment.create).not.toHaveBeenCalled()
    expect(prisma.assignment.update).not.toHaveBeenCalled()
    expect(prisma.correctiveAction.create).not.toHaveBeenCalled()
    expect(prisma.auditEvent.create).not.toHaveBeenCalled()
    expect(timeline.log).not.toHaveBeenCalled()
    expect(risk.recalculatePersonRisk).not.toHaveBeenCalled()
    expect(assessments).toEqual([])
    expect(assignments.every((a) => a.risk === 'LOW')).toBe(true)
  }

  describe('rule A — only ADMIN', () => {
    it('an ADMIN evaluating another person of the organization is accepted', async () => {
      const res = await submit('adminA', { assignmentId: 'asg-staff', score: 90 }).expect(201)
      expect(res.body).toMatchObject({ id: 'assessment-1', assignmentId: 'asg-staff', personId: 'person-staff-a', score: 90, risk: 'LOW' })
      expect(assessments).toHaveLength(1)
      expect(risk.recalculatePersonRisk).toHaveBeenCalledWith('person-staff-a', expect.any(String))
    })

    it.each(NON_ADMIN)('%s gets 403 before any database access, with no effects', async (user) => {
      await submit(user, { assignmentId: 'asg-viewer', score: 90 }).expect(403)
      for (const mock of allPrismaMocks()) expect(mock).not.toHaveBeenCalled()
      expectNoEffects()
    })

    it('an unauthenticated request gets 401, with no effects', async () => {
      await submit(undefined, { assignmentId: 'asg-staff', score: 90 }).expect(401)
      for (const mock of allPrismaMocks()) expect(mock).not.toHaveBeenCalled()
      expectNoEffects()
    })

    it('an ADMIN of another organization gets 404 without data, with no effects', async () => {
      const res = await submit('adminB', { assignmentId: 'asg-staff', score: 90 }).expect(404)
      expect(res.body).toMatchObject({ success: false, error: 'Assignment não encontrado', data: null })
      expect(JSON.stringify(res.body)).not.toMatch(/person-staff-a|track-a|org-a/)
      const missing = await submit('adminB', { assignmentId: 'asg-missing', score: 90 }).expect(404)
      const { path: _f, ...foreignBody } = res.body
      const { path: _m, ...missingBody } = missing.body
      expect(foreignBody).toEqual(missingBody)
      expectNoEffects()
    })
  })

  describe('rule B — no self-assessment', () => {
    it('an ADMIN evaluating their own assignment gets 403, with no effects', async () => {
      const res = await submit('adminA', { assignmentId: 'asg-admin-own', score: 100 }).expect(403)
      expect(res.body.error).toBe('Não é permitido avaliar a própria atribuição.')
      expectNoEffects()
    })

    it('the comparison uses the session person and the stored assignment, not the body', async () => {
      // A forged body claiming another evaluator does not unlock the ADMIN's own assignment.
      await submit('adminA', { assignmentId: 'asg-admin-own', score: 100, personId: 'person-staff-a', actorPersonId: 'person-staff-a', evaluatorId: 'person-staff-a' }).expect(403)
      expectNoEffects()
    })

    it.each(['adminNoPerson', 'adminNoUser'] as UserKey[])('%s (session identity not verifiable) is denied before any lookup, with no effects', async (user) => {
      await submit(user, { assignmentId: 'asg-staff', score: 90 }).expect(403)
      expect(prisma.assignment.findFirst).not.toHaveBeenCalled()
      expectNoEffects()
    })
  })

  describe('rule C — authorship from the session', () => {
    it('the accepted assessment is audited with the real author, organization and entity', async () => {
      const res = await submit('adminA', { assignmentId: 'asg-staff', score: 90 }).expect(201)
      expect(audits).toEqual([
        expect.objectContaining({
          orgId: 'org-a',
          action: 'ASSESSMENT_SUBMITTED',
          actorUserId: 'u-admin-a',
          actorPersonId: 'person-admin-a',
          personId: 'person-staff-a',
          entityType: 'ASSESSMENT',
          entityId: res.body.id,
          context: 'Avaliação da trilha "Trilha track-a" concluída com score 90',
        }),
      ])
    })

    it('identity, role or organization fields in the body change neither authorization nor authorship', async () => {
      // A STAFF claiming ADMIN in the body is still refused.
      await submit('staffA', { assignmentId: 'asg-viewer', score: 90, role: 'ADMIN', userId: 'u-admin-a', actorUserId: 'u-admin-a' }).expect(403)
      expectNoEffects()
      // An ADMIN with forged authorship fields: the audit records the session identity only.
      const forged = { actorUserId: 'u-forged', actorPersonId: 'person-forged', evaluatorId: 'person-forged', userId: 'u-forged', role: 'VIEWER', personId: 'person-viewer-a', trackId: 'track-b' }
      const res = await submit('adminA', { assignmentId: 'asg-staff', score: 90, ...forged }).expect(201)
      expect(res.body).toMatchObject({ personId: 'person-staff-a', trackId: 'track-a' })
      expect(audits).toHaveLength(1)
      expect(audits[0]).toMatchObject({ orgId: 'org-a', actorUserId: 'u-admin-a', actorPersonId: 'person-admin-a', entityType: 'ASSESSMENT', entityId: res.body.id })
      expect(JSON.stringify(audits)).not.toMatch(/forged/)
    })

    it('a client orgId of another organization is refused (403) with no effects', async () => {
      await submit('adminA', { assignmentId: 'asg-staff', score: 90, orgId: 'org-b' }).expect(403)
      expectNoEffects()
    })

    it('a critical assessment audits the corrective action with the same author', async () => {
      const res = await submit('adminA', { assignmentId: 'asg-staff', score: 20 }).expect(201)
      expect(correctives).toEqual([expect.objectContaining({ id: 'corrective-1', personId: 'person-staff-a', status: 'OPEN' })])
      expect(audits).toEqual([
        expect.objectContaining({
          orgId: 'org-a',
          action: 'CORRECTIVE_ACTION_CREATED',
          actorUserId: 'u-admin-a',
          actorPersonId: 'person-admin-a',
          personId: 'person-staff-a',
          entityType: 'CORRECTIVE_ACTION',
          entityId: 'corrective-1',
          context: 'Ação corretiva criada automaticamente após avaliação crítica',
          metadata: { assessmentId: res.body.id },
        }),
        expect.objectContaining({ action: 'ASSESSMENT_SUBMITTED', actorUserId: 'u-admin-a', actorPersonId: 'person-admin-a', entityType: 'ASSESSMENT', entityId: res.body.id }),
      ])
      // The timeline event keeps its existing content.
      expect(timeline.log).toHaveBeenCalledWith(expect.objectContaining({ orgId: 'org-a', action: 'CORRECTIVE_ACTION_CREATED', personId: 'person-staff-a', metadata: expect.objectContaining({ correctiveActionId: 'corrective-1', source: 'ASSESSMENT', score: 20, risk: 'CRITICAL' }) }))
    })

    it('a duplicate critical assessment keeps the deduplication and audits the skip with the author', async () => {
      await submit('adminA', { assignmentId: 'asg-staff', score: 20 }).expect(201)
      audits.length = 0
      const second = await submit('adminA', { assignmentId: 'asg-staff', score: 10 }).expect(201)
      expect(correctives).toHaveLength(1)
      expect(audits[0]).toMatchObject({
        orgId: 'org-a',
        action: 'CORRECTIVE_ACTION_SKIPPED_DUPLICATE',
        actorUserId: 'u-admin-a',
        actorPersonId: 'person-admin-a',
        entityType: 'CORRECTIVE_ACTION',
        entityId: 'corrective-1',
        context: 'Corretiva OPEN já existe (id=corrective-1) para avaliação crítica recente',
        metadata: { assessmentId: second.body.id },
      })
    })
  })

  describe('existing rules are preserved', () => {
    it('score range and unfinished track still answer 400 for an ADMIN', async () => {
      await submit('adminA', { assignmentId: 'asg-staff', score: 101 }).expect(400)
      assignments[0].progress = 50
      await submit('adminA', { assignmentId: 'asg-staff', score: 90 }).expect(400)
      expectNoEffects()
    })

    it('guards: JwtAuthGuard → RolesGuard on the class, @Roles(ADMIN) and OperationalStateGuard on the route', () => {
      const handler = AssessmentsController.prototype.submit
      expect(Reflect.getMetadata(GUARDS_METADATA, AssessmentsController)).toEqual([JwtAuthGuard, RolesGuard])
      expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual(['ADMIN'])
      expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toEqual([OperationalStateGuard])
    })

    it('OperationalStateGuard keeps its rules: ADMIN is never operationally blocked (unchanged bypass)', async () => {
      operationalState.getStatus.mockResolvedValueOnce({ state: 'SUSPENDED', riskScore: 99 })
      await submit('adminA', { assignmentId: 'asg-staff', score: 90 }).expect(201)
      expect(operationalState.getStatus).not.toHaveBeenCalled()
    })

    it('OperationalStateGuard still blocks SUSPENDED and RESTRICTED non-admins on this POST', async () => {
      const guard = new OperationalStateGuard(operationalState as any, timeline as any)
      const ctx = (role: string) => ({ switchToHttp: () => ({ getRequest: () => ({ method: 'POST', originalUrl: '/assessments', user: { role, personId: 'p', orgId: 'org-a' } }) }) }) as any
      for (const state of ['SUSPENDED', 'RESTRICTED']) {
        operationalState.getStatus.mockResolvedValueOnce({ state, riskScore: 90 })
        await expect(guard.canActivate(ctx('STAFF'))).rejects.toMatchObject({ status: 403 })
      }
      operationalState.getStatus.mockResolvedValueOnce({ state: 'NORMAL', riskScore: 0 })
      await expect(guard.canActivate(ctx('STAFF'))).resolves.toBe(true)
    })
  })
})
