import { Body, Controller, Get, INestApplication, Param, Post, Query, UnauthorizedException, UseGuards, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { JwtAuthGuard } from '../../auth/jwt-auth.guard'
import { RolesGuard } from '../../auth/guards/roles.guard'
import { Public } from '../../auth/decorators/public.decorator'
import { Org } from '../../auth/decorators/org.decorator'
import { OperationalStateGuard } from '../../people/operational-state.guard'
import { PrismaService } from '../../prisma/prisma.service'
import { RiskSnapshotService } from '../../risk/risk-snapshot.service'
import { PersonsRiskHistoryController } from '../../persons/persons.risk-history.controller'
import { AssignmentsController } from '../../assignments/assignments.controller'
import { AssignmentsService } from '../../assignments/assignments.service'
import { AssessmentsController } from '../../assessments/assessments.controller'
import { AssessmentsService } from '../../assessments/assessments.service'
import { TimelineService } from '../../timeline/timeline.service'
import { RiskService } from '../../risk/risk.service'
import { AuditService } from '../../audit/audit.service'
import { CorrectiveActionsService } from '../../corrective-actions/corrective-actions.service'
import { AllowCrossTenantParam, TENANT_ACCESS_INTERCEPTOR_PROVIDER } from './tenant-access.guard'

// Regression for C6. The global TenantAccessGuard ran before controller-level JwtAuthGuard, saw no
// request.user and let every request through, so client-supplied organization ids were never checked.
// Routes on models without an orgId column (not scoped by the Prisma tenant middleware) also lacked
// explicit organization filters.
const USERS: Record<string, { userId: string; orgId: string | undefined; role: string; personId: string }> = {
  adminA: { userId: 'u-admin-a', orgId: 'org-a', role: 'ADMIN', personId: 'person-admin-a' },
  staffA: { userId: 'u-staff-a', orgId: 'org-a', role: 'STAFF', personId: 'person-a' },
  adminB: { userId: 'u-admin-b', orgId: 'org-b', role: 'ADMIN', personId: 'person-admin-b' },
  staffB: { userId: 'u-staff-b', orgId: 'org-b', role: 'STAFF', personId: 'person-b' },
  staffOtherB: { userId: 'u-staff-other-b', orgId: 'org-b', role: 'STAFF', personId: 'person-other-b' },
  noOrg: { userId: 'u-no-org', orgId: undefined, role: 'ADMIN', personId: 'person-x' },
}

// In-memory data for two organizations. Models below have no orgId column, like in the schema.
const PERSONS = [{ id: 'person-a', orgId: 'org-a' }, { id: 'person-b', orgId: 'org-b' }]
const orgOf = (personId: string) => PERSONS.find((p) => p.id === personId)?.orgId
const SNAPSHOTS = [
  { id: 'rs-a', personId: 'person-a', score: 10, reason: 'org-a risk', createdAt: new Date('2026-01-01') },
  { id: 'rs-b', personId: 'person-b', score: 90, reason: 'org-b risk', createdAt: new Date('2026-01-02') },
]
const ASSIGNMENTS = [
  { id: 'asg-a', personId: 'person-a', trackId: 'track-a', progress: 50 },
  { id: 'asg-b', personId: 'person-b', trackId: 'track-b', progress: 100 },
]
const matchesPerson = (personId: string, where: any) => !where?.person?.orgId || orgOf(personId) === where.person.orgId
const withRelations = (a: (typeof ASSIGNMENTS)[number]) => ({
  ...a,
  person: { id: a.personId, orgId: orgOf(a.personId) },
  track: { id: a.trackId, title: `Track ${a.trackId}`, items: [{ id: `${a.trackId}-item-1`, order: 1 }] },
  completions: [],
})

const prisma = {
  riskSnapshot: {
    findMany: jest.fn(async ({ where }: any) => SNAPSHOTS.filter((s) => s.personId === where.personId && matchesPerson(s.personId, where))),
  },
  assignment: {
    findUnique: jest.fn(async ({ where }: any) => {
      const found = ASSIGNMENTS.find((a) => a.id === where.id)
      return found ? withRelations(found) : null
    }),
    findFirst: jest.fn(async ({ where }: any) => {
      const found = ASSIGNMENTS.find((a) => a.id === where.id && matchesPerson(a.personId, where))
      return found ? withRelations(found) : null
    }),
  },
}
const timeline = { log: jest.fn().mockResolvedValue(undefined) }
const sideEffects = { risk: { recalculate: jest.fn() }, audit: { log: jest.fn() }, corrective: { create: jest.fn() } }

const seen: Array<{ route: string; orgId: unknown }> = []

@Controller('probe')
@UseGuards(JwtAuthGuard)
class ProbeController {
  // Untyped bodies skip ValidationPipe whitelisting, like any handler that takes `body: any`.
  @Post('body') body(@Org() orgId: string, @Body() body: any) { seen.push({ route: 'body', orgId: body?.orgId }); return { orgId } }
  @Get('query') query(@Org() orgId: string, @Query() query: any) { seen.push({ route: 'query', orgId: query?.orgId }); return { orgId } }
  @Get('org/:orgId') param(@Param('orgId') orgId: string) { seen.push({ route: 'param', orgId }); return { orgId } }
  @Public() @Post('public') publicRoute(@Body() body: any) { seen.push({ route: 'public', orgId: body?.orgId }); return { ok: true } }
}

@Controller('probe-cross')
@UseGuards(JwtAuthGuard)
@AllowCrossTenantParam()
class CrossTenantProbeController {
  @Get('tenants/:orgId') tenant(@Param('orgId') orgId: string, @Query() query: any) { seen.push({ route: 'cross', orgId: query?.orgId ?? orgId }); return { orgId } }
}

describe('C6: organization isolation over HTTP', () => {
  let app: INestApplication
  const as = (key: keyof typeof USERS) => ({ 'x-test-user': key })
  const http = () => request(app.getHttpServer())

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [ProbeController, CrossTenantProbeController, PersonsRiskHistoryController, AssignmentsController, AssessmentsController],
      providers: [
        TENANT_ACCESS_INTERCEPTOR_PROVIDER,
        RolesGuard,
        RiskSnapshotService,
        AssignmentsService,
        AssessmentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: TimelineService, useValue: timeline },
        { provide: RiskService, useValue: sideEffects.risk },
        { provide: AuditService, useValue: sideEffects.audit },
        { provide: CorrectiveActionsService, useValue: sideEffects.corrective },
      ],
    })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: (context: any) => {
        const handler = context.getHandler()
        if (Reflect.getMetadata('isPublic', handler)) return true
        const req = context.switchToHttp().getRequest()
        const user = USERS[req.headers['x-test-user']]
        if (!user) throw new UnauthorizedException()
        req.user = { sub: user.userId, ...user }
        return true
      } })
      .overrideGuard(OperationalStateGuard).useValue({ canActivate: () => true })
      .compile()
    app = module.createNestApplication()
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
    await app.init()
  })

  afterAll(async () => app?.close())
  beforeEach(() => { jest.clearAllMocks(); seen.length = 0 })

  describe('client-supplied organization ids (header, body, query, route)', () => {
    it.each(['adminA', 'staffA'] as const)('%s cannot target org-b through any channel', async (user) => {
      await http().post('/probe/body').set(as(user)).set('x-org-id', 'org-b').send({}).expect(403)
      await http().post('/probe/body').set(as(user)).send({ orgId: 'org-b' }).expect(403)
      await http().post('/probe/body').set(as(user)).send({ organizationId: 'org-b' }).expect(403)
      await http().get('/probe/query?orgId=org-b').set(as(user)).expect(403)
      await http().get('/probe/query?organizationId=org-b').set(as(user)).expect(403)
      await http().get('/probe/query?orgId=org-a&orgId=org-b').set(as(user)).expect(403)
      await http().get('/probe/org/org-b').set(as(user)).expect(403)
      expect(seen).toEqual([])
    })

    it('accepts ids that repeat the authenticated organization and requests without any', async () => {
      await http().post('/probe/body').set(as('adminA')).set('x-org-id', 'org-a').send({ orgId: 'org-a' }).expect(201)
      await http().get('/probe/query?orgId=org-a').set(as('staffA')).expect(200)
      await http().get('/probe/org/org-a').set(as('adminA')).expect(200)
      const res = await http().post('/probe/body').set(as('adminB')).send({}).expect(201)
      expect(res.body).toEqual({ orgId: 'org-b' })
    })

    it('rejects an authenticated token without organization', async () => {
      await http().post('/probe/body').set(as('noOrg')).send({}).expect(403)
      expect(seen).toEqual([])
    })

    it('leaves public routes (no session) untouched', async () => {
      await http().post('/probe/public').send({ orgId: 'any-org' }).expect(201)
      expect(seen).toEqual([{ route: 'public', orgId: 'any-org' }])
    })

    it('allows the :orgId route parameter only on routes marked for explicit cross-tenant authorization', async () => {
      await http().get('/probe-cross/tenants/org-b').set(as('adminA')).expect(200)
      await http().get('/probe-cross/tenants/org-b?orgId=org-b').set(as('adminA')).expect(403)
      await http().get('/probe-cross/tenants/org-b').set(as('adminA')).set('x-org-id', 'org-b').expect(403)
    })
  })

  describe('GET /persons/:id/risk-history (RiskSnapshot has no orgId column)', () => {
    it.each(['adminA', 'staffA'] as const)('%s cannot read the risk history of a person from org-b', async (user) => {
      const res = await http().get('/persons/person-b/risk-history').set(as(user)).expect(200)
      expect(res.body).toEqual([])
      expect(JSON.stringify(res.body)).not.toContain('org-b risk')
    })

    it('returns the history of a person from the same organization', async () => {
      const res = await http().get('/persons/person-b/risk-history').set(as('staffB')).expect(200)
      expect(res.body).toEqual([expect.objectContaining({ id: 'rs-b', reason: 'org-b risk' })])
    })
  })

  describe('assignments (Assignment has no orgId column)', () => {
    it('an ADMIN of org-a cannot start or read an assignment of org-b', async () => {
      await http().post('/assignments/asg-b/start').set(as('adminA')).expect(404)
      await http().get('/assignments/asg-b/next-item').set(as('adminA')).expect(404)
      expect(timeline.log).not.toHaveBeenCalled()
    })

    it('an ADMIN keeps full access inside their own organization', async () => {
      await http().post('/assignments/asg-b/start').set(as('adminB')).expect(201)
      const next = await http().get('/assignments/asg-b/next-item').set(as('adminB')).expect(200)
      expect(next.body).toEqual(expect.objectContaining({ id: 'track-b-item-1' }))
      expect(timeline.log).toHaveBeenCalledWith(expect.objectContaining({ orgId: 'org-b', action: 'ASSIGNMENT_STARTED' }))
    })

    it('a non-admin of the same organization still cannot reach a colleague assignment', async () => {
      await http().post('/assignments/asg-b/start').set(as('staffB')).expect(201)
      await http().get('/assignments/asg-b/next-item').set(as('staffOtherB')).expect(403)
    })
  })

  describe('POST /assessments', () => {
    // C8 PR3-3A: only ADMINs submit assessments, so a STAFF is refused (403) before the lookup.
    it.each([['adminA', 404], ['staffA', 403]] as const)('%s cannot submit an assessment for an assignment of org-b (%s)', async (user, status) => {
      await http().post('/assessments').set(as(user)).send({ assignmentId: 'asg-b', score: 95 }).expect(status)
      for (const fn of [sideEffects.risk.recalculate, sideEffects.audit.log, sideEffects.corrective.create, timeline.log]) {
        expect(fn).not.toHaveBeenCalled()
      }
    })

    it('rejects an orgId in the body pointing to another organization', async () => {
      await http().post('/assessments').set(as('adminA')).send({ assignmentId: 'asg-b', score: 95, orgId: 'org-b' }).expect(403)
    })

    it('finds assignments of the same organization (business validation still applies)', async () => {
      const res = await http().post('/assessments').set(as('adminA')).send({ assignmentId: 'asg-a', score: 95 }).expect(400)
      expect(res.body.message).toContain('trilha ainda não concluída')
    })
  })
})
