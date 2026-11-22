import { INestApplication, ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { Test } from '@nestjs/testing'
import { PrismaClient, UserRole } from '@prisma/client'
import { randomUUID } from 'crypto'
import request from 'supertest'

import { AssessmentsController } from '../../src/assessments/assessments.controller'
import { AssessmentsService } from '../../src/assessments/assessments.service'
import { AuditService } from '../../src/audit/audit.service'
import { RolesGuard } from '../../src/auth/guards/roles.guard'
import { JwtAuthGuard } from '../../src/auth/jwt-auth.guard'
import { JwtStrategy } from '../../src/auth/jwt.strategy'
import { ApiExceptionFilter } from '../../src/common/http/api-exception.filter'
import { CorrectiveActionsService } from '../../src/corrective-actions/corrective-actions.service'
import { OperationalStateGuard } from '../../src/people/operational-state.guard'
import { OperationalStateService } from '../../src/people/operational-state.service'
import { PrismaService } from '../../src/prisma/prisma.service'
import { RiskService } from '../../src/risk/risk.service'
import { TimelineService } from '../../src/timeline/timeline.service'
import { describeRealIntegration } from './infra-guards'

/**
 * C8 PR3-3A — POST /assessments with the real session validation (JwtStrategy + persisted
 * session) and PostgreSQL: only ADMINs submit, nobody evaluates their own assignment, other
 * organizations get 404, and the accepted assessment is audited with the session author.
 * Risk recalculation and timeline are stubbed: they are outside this authorization check.
 */
describeRealIntegration('Assessments: roles, self-assessment and authorship with PostgreSQL', () => {
  jest.setTimeout(30000)
  const prisma = new PrismaClient()
  const secret = 'assessments-roles-tests-only-explicit-secret'
  const jwt = new JwtService({ secret })
  const orgIds: string[] = []
  const risk = { recalculatePersonRisk: jest.fn().mockResolvedValue(0) }
  const timeline = { log: jest.fn().mockResolvedValue(undefined) }
  let app: INestApplication
  let orgId: string

  const token = (user: any) =>
    `Bearer ${jwt.sign({ sub: user.id, orgId: user.orgId, role: user.role, personId: user.person?.id, sessionVersion: user.sessionVersion })}`

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [PassportModule],
      controllers: [AssessmentsController],
      providers: [
        AssessmentsService,
        AuditService,
        JwtStrategy,
        JwtAuthGuard,
        RolesGuard,
        OperationalStateGuard,
        { provide: OperationalStateService, useValue: { getStatus: jest.fn().mockResolvedValue({ state: 'NORMAL', riskScore: 0 }) } },
        { provide: RiskService, useValue: risk },
        { provide: TimelineService, useValue: timeline },
        { provide: CorrectiveActionsService, useValue: {} },
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: (key: string) => (key === 'JWT_SECRET' ? secret : undefined) } },
      ],
    }).compile()
    app = module.createNestApplication()
    app.useGlobalFilters(new ApiExceptionFilter())
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, transformOptions: { enableImplicitConversion: true } }))
    await app.init()
  })

  async function member(role: UserRole, org = orgId) {
    return prisma.user.create({
      data: {
        orgId: org,
        role,
        email: `${randomUUID()}@assessments-roles.test`,
        active: true,
        password: 'test-password-hash',
        person: { create: { orgId: org, name: `Pessoa ${role}`, role: 'TECH', active: true } },
      },
      include: { person: true },
    })
  }

  async function newOrg() {
    const id = randomUUID()
    orgIds.push(id)
    await prisma.organization.create({ data: { id, name: 'Assessments roles test', slug: `assessments-roles-${id}` } })
    return id
  }

  /** A completed assignment of `personId` on a fresh track of the person's organization. */
  async function completedAssignment(personId: string, org = orgId) {
    const track = await prisma.track.create({ data: { orgId: org, slug: `t-${randomUUID()}`, title: 'Trilha avaliada', status: 'ACTIVE', version: 1 } })
    return prisma.assignment.create({ data: { personId, trackId: track.id, progress: 100 } })
  }

  const effects = async (assignmentId: string) => ({
    assessments: await prisma.assessment.count({ where: { assignmentId } }),
    assignment: await prisma.assignment.findUnique({ where: { id: assignmentId }, select: { risk: true, progress: true } }),
    correctives: await prisma.correctiveAction.count({ where: { person: { orgId } } }),
    audits: await prisma.auditEvent.count({ where: { orgId } }),
  })

  beforeEach(async () => {
    orgId = await newOrg()
    jest.clearAllMocks()
  })

  afterAll(async () => {
    await app?.close()
    await prisma.auditEvent.deleteMany({ where: { orgId: { in: orgIds } } })
    await prisma.assessment.deleteMany({ where: { person: { orgId: { in: orgIds } } } })
    await prisma.correctiveAction.deleteMany({ where: { person: { orgId: { in: orgIds } } } })
    await prisma.assignment.deleteMany({ where: { person: { orgId: { in: orgIds } } } })
    await prisma.track.deleteMany({ where: { orgId: { in: orgIds } } })
    await prisma.person.deleteMany({ where: { orgId: { in: orgIds } } })
    await prisma.user.deleteMany({ where: { orgId: { in: orgIds } } })
    await prisma.organization.deleteMany({ where: { id: { in: orgIds } } })
    await prisma.$disconnect()
  })

  const http = () => request(app.getHttpServer())

  it('an ADMIN evaluating another person of the organization is accepted and audited with the session author', async () => {
    const admin = await member('ADMIN')
    const staff = await member('STAFF')
    const assignment = await completedAssignment(staff.person!.id)
    const res = await http().post('/assessments').set('Authorization', token(admin))
      .send({ assignmentId: assignment.id, score: 20, actorUserId: 'forged-user', actorPersonId: 'forged-person', evaluatorId: 'forged', role: 'VIEWER' })
      .expect(201)
    expect(res.body).toMatchObject({ assignmentId: assignment.id, personId: staff.person!.id, score: 20, risk: 'CRITICAL' })

    const events = await prisma.auditEvent.findMany({ where: { orgId }, orderBy: { createdAt: 'asc' } })
    const corrective = await prisma.correctiveAction.findFirstOrThrow({ where: { personId: staff.person!.id } })
    expect(events).toEqual([
      expect.objectContaining({ orgId, action: 'CORRECTIVE_ACTION_CREATED', actorUserId: admin.id, actorPersonId: admin.person!.id, personId: staff.person!.id, entityType: 'CORRECTIVE_ACTION', entityId: corrective.id, metadata: { assessmentId: res.body.id } }),
      expect.objectContaining({ orgId, action: 'ASSESSMENT_SUBMITTED', actorUserId: admin.id, actorPersonId: admin.person!.id, personId: staff.person!.id, entityType: 'ASSESSMENT', entityId: res.body.id }),
    ])
    expect(JSON.stringify(events)).not.toContain('forged')
    expect((await prisma.assignment.findUnique({ where: { id: assignment.id } }))!.risk).toBe('CRITICAL')
  })

  it('an ADMIN evaluating their own assignment gets 403 with no write', async () => {
    const admin = await member('ADMIN')
    const own = await completedAssignment(admin.person!.id)
    const before = await effects(own.id)
    await http().post('/assessments').set('Authorization', token(admin)).send({ assignmentId: own.id, score: 100, actorPersonId: randomUUID() }).expect(403)
    expect(await effects(own.id)).toEqual(before)
    expect(before).toMatchObject({ assessments: 0, audits: 0 })
    expect(risk.recalculatePersonRisk).not.toHaveBeenCalled()
    expect(timeline.log).not.toHaveBeenCalled()
  })

  it.each(['MANAGER', 'STAFF', 'VIEWER'] as UserRole[])('%s gets 403 with no write', async (role) => {
    const user = await member(role)
    const colleague = await member('STAFF')
    const assignment = await completedAssignment(colleague.person!.id)
    await http().post('/assessments').set('Authorization', token(user)).send({ assignmentId: assignment.id, score: 10, role: 'ADMIN' }).expect(403)
    expect(await effects(assignment.id)).toMatchObject({ assessments: 0, assignment: { risk: 'LOW', progress: 100 }, correctives: 0, audits: 0 })
    expect(risk.recalculatePersonRisk).not.toHaveBeenCalled()
  })

  it('an ADMIN of another organization gets 404, identical to a missing id, with no write', async () => {
    const staffA = await member('STAFF')
    const assignment = await completedAssignment(staffA.person!.id)
    const orgB = await newOrg()
    const adminB = await member('ADMIN', orgB)
    const foreign = await http().post('/assessments').set('Authorization', token(adminB)).send({ assignmentId: assignment.id, score: 10 }).expect(404)
    const missing = await http().post('/assessments').set('Authorization', token(adminB)).send({ assignmentId: randomUUID(), score: 10 }).expect(404)
    const { path: _f, ...foreignBody } = foreign.body
    const { path: _m, ...missingBody } = missing.body
    expect(foreignBody).toEqual(missingBody)
    expect(JSON.stringify(foreign.body)).not.toContain(staffA.person!.id)
    expect(await effects(assignment.id)).toMatchObject({ assessments: 0, assignment: { risk: 'LOW' }, correctives: 0, audits: 0 })
  })

  it('a revoked session and missing credentials get 401 with no write', async () => {
    const admin = await member('ADMIN')
    const staff = await member('STAFF')
    const assignment = await completedAssignment(staff.person!.id)
    const stale = token(admin)
    await prisma.user.update({ where: { id: admin.id }, data: { sessionVersion: { increment: 1 } } })
    await http().post('/assessments').set('Authorization', stale).send({ assignmentId: assignment.id, score: 10 }).expect(401)
    await http().post('/assessments').send({ assignmentId: assignment.id, score: 10 }).expect(401)
    expect(await effects(assignment.id)).toMatchObject({ assessments: 0, correctives: 0, audits: 0 })
  })
})
