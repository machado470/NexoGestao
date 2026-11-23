import { INestApplication, ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { Test } from '@nestjs/testing'
import { PrismaClient, UserRole } from '@prisma/client'
import { randomUUID } from 'crypto'
import request from 'supertest'

import { RolesGuard } from '../../src/auth/guards/roles.guard'
import { JwtAuthGuard } from '../../src/auth/jwt-auth.guard'
import { JwtStrategy } from '../../src/auth/jwt.strategy'
import { RequestContextService } from '../../src/common/context/request-context.service'
import { TENANT_ACCESS_INTERCEPTOR_PROVIDER } from '../../src/common/guards/tenant-access.guard'
import { ApiExceptionFilter } from '../../src/common/http/api-exception.filter'
import { EnforcementController } from '../../src/governance/enforcement.controller'
import { EnforcementEngineService } from '../../src/governance/enforcement-engine.service'
import { EnforcementPolicyService } from '../../src/governance/enforcement-policy.service'
import { GovernanceRunService } from '../../src/governance/governance-run.service'
import { OperationalStateRepository } from '../../src/people/operational-state.repository'
import { PrismaService } from '../../src/prisma/prisma.service'
import { TemporalRiskService } from '../../src/risk/temporal-risk.service'
import { TimelineService } from '../../src/timeline/timeline.service'
import { WebhookDispatcher } from '../../src/webhooks/webhook.dispatcher'
import { describeRealIntegration } from './infra-guards'

/**
 * C8 PR3-3B-6 — POST /admin/enforcement/run-once with the real persisted-session validation
 * (JwtStrategy), the real RolesGuard and the real enforcement engine on PostgreSQL. Only an ADMIN
 * runs it, for the session organization only; refused requests leave no trace in the database.
 */
describeRealIntegration('Manual enforcement run-once: authorization with real sessions and PostgreSQL', () => {
  jest.setTimeout(60000)
  const prisma = new PrismaClient()
  const secret = 'enforcement-run-once-tests-only-explicit-secret'
  const jwt = new JwtService({ secret })
  const orgIds: string[] = []
  const previousFlag = process.env.ALLOW_MANUAL_ENFORCEMENT
  let app: INestApplication

  const token = (user: any) =>
    `Bearer ${jwt.sign({ sub: user.id, orgId: user.orgId, role: user.role, personId: user.person?.id, sessionVersion: user.sessionVersion })}`

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [PassportModule],
      controllers: [EnforcementController],
      providers: [
        TENANT_ACCESS_INTERCEPTOR_PROVIDER,
        EnforcementEngineService,
        EnforcementPolicyService,
        GovernanceRunService,
        TemporalRiskService,
        TimelineService,
        OperationalStateRepository,
        JwtStrategy,
        JwtAuthGuard,
        RolesGuard,
        { provide: RequestContextService, useValue: { requestId: 'req-run-once', userId: null, personId: null, orgId: null, correlationId: 'req-run-once', getAll: () => ({}) } },
        { provide: WebhookDispatcher, useValue: { dispatchTimelineEvent: jest.fn().mockResolvedValue(undefined) } },
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: (key: string) => (key === 'JWT_SECRET' ? secret : undefined) } },
      ],
    }).compile()
    app = module.createNestApplication()
    app.useGlobalFilters(new ApiExceptionFilter())
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
    await app.init()
  })

  beforeEach(() => {
    process.env.ALLOW_MANUAL_ENFORCEMENT = 'true'
  })

  afterAll(async () => {
    if (previousFlag === undefined) delete process.env.ALLOW_MANUAL_ENFORCEMENT
    else process.env.ALLOW_MANUAL_ENFORCEMENT = previousFlag
    await app?.close()
    const people = { orgId: { in: orgIds } }
    await prisma.auditEvent.deleteMany({ where: { orgId: { in: orgIds } } })
    await prisma.timelineEvent.deleteMany({ where: { orgId: { in: orgIds } } })
    await prisma.governanceRun.deleteMany({ where: { orgId: { in: orgIds } } })
    await prisma.riskSnapshot.deleteMany({ where: { person: people } })
    await prisma.correctiveAction.deleteMany({ where: { person: people } })
    await prisma.assignment.deleteMany({ where: { person: people } })
    await prisma.track.deleteMany({ where: { orgId: { in: orgIds } } })
    await prisma.person.deleteMany({ where: people })
    await prisma.user.deleteMany({ where: { orgId: { in: orgIds } } })
    await prisma.organization.deleteMany({ where: { id: { in: orgIds } } })
    await prisma.$disconnect()
  })

  async function newOrg() {
    const id = randomUUID()
    orgIds.push(id)
    await prisma.organization.create({ data: { id, name: 'Run-once auth', slug: `run-once-${id}` } })
    return id
  }
  async function member(orgId: string, role: UserRole) {
    return prisma.user.create({
      data: { orgId, role, email: `${randomUUID()}@run-once.test`, active: true, password: 'test-password-hash', person: { create: { orgId, name: `Pessoa ${role}`, role: 'TECH', active: true } } },
      include: { person: true },
    })
  }
  /** A person whose real risk is RESTRICTED (progress 0 → +60, two critical events → +10): the engine creates one action. */
  async function restrictedPerson(orgId: string) {
    const p = await prisma.person.create({ data: { orgId, name: 'Restrita', role: 'TECH', active: true, operationalRiskScore: 70, riskScore: 70, operationalState: 'RESTRICTED', operationalStateUpdatedAt: new Date() } })
    const t = await prisma.track.create({ data: { orgId, slug: `t-${randomUUID()}`, title: 't', status: 'ACTIVE', version: 1 } })
    await prisma.assignment.create({ data: { personId: p.id, trackId: t.id, progress: 0 } })
    await prisma.timelineEvent.createMany({ data: [1, 2].map(() => ({ orgId, personId: p.id, action: 'APPOINTMENT_CANCELLED' })) })
    return p
  }
  /** Everything a run writes for an organization. */
  const effects = async (orgId: string) => ({
    correctives: await prisma.correctiveAction.count({ where: { person: { orgId } } }),
    runs: await prisma.governanceRun.count({ where: { orgId } }),
    engineEvents: await prisma.timelineEvent.count({ where: { orgId, action: { in: ['GOVERNANCE_RUN_STARTED', 'GOVERNANCE_RUN_COMPLETED', 'OPERATIONAL_STATE_ENFORCED', 'OPERATIONAL_STATE_CHANGED', 'OPERATIONAL_WARNING_RAISED'] } } }),
  })
  const http = () => request(app.getHttpServer())
  const runOnce = (auth?: string, path = '/admin/enforcement/run-once') => {
    const req = http().post(path)
    return auth ? req.set('Authorization', auth) : req
  }

  it('an active ADMIN runs the engine for its own organization (real effects, contract preserved)', async () => {
    const orgId = await newOrg()
    const admin = await member(orgId, 'ADMIN')
    const p = await restrictedPerson(orgId)
    const res = await runOnce(token(admin)).expect(201)
    expect(res.body).toMatchObject({ ok: true, data: { engine: { evaluated: 2, correctivesCreated: 1, restrictedCount: 1 }, run: expect.any(Object) } })
    expect(await prisma.correctiveAction.count({ where: { personId: p.id, status: 'OPEN' } })).toBe(1)
    expect(await prisma.governanceRun.count({ where: { orgId } })).toBe(1)
  })

  it.each(['MANAGER', 'STAFF', 'VIEWER'] as UserRole[])('an active %s gets 403 and nothing is written', async (role) => {
    const orgId = await newOrg()
    const user = await member(orgId, role)
    await restrictedPerson(orgId)
    const before = await effects(orgId)
    const res = await runOnce(token(user)).expect(403)
    expect(res.body.error).toMatch(/Sem permissão/)
    expect(await effects(orgId)).toEqual(before)
    expect(before).toMatchObject({ correctives: 0, runs: 0 })
  })

  it('missing, invalid and revoked credentials get 401 and nothing is written', async () => {
    const orgId = await newOrg()
    const admin = await member(orgId, 'ADMIN')
    await restrictedPerson(orgId)
    const before = await effects(orgId)
    await runOnce().expect(401)
    await runOnce('Bearer not-a-jwt').expect(401)
    await runOnce(`Bearer ${new JwtService({ secret: 'another-secret' }).sign({ sub: admin.id, orgId, role: 'ADMIN', personId: admin.person!.id, sessionVersion: 0 })}`).expect(401)
    const stale = token(admin)
    await prisma.user.update({ where: { id: admin.id }, data: { sessionVersion: { increment: 1 } } })
    await runOnce(stale).expect(401)
    // A token claiming ADMIN for a user whose persisted role is VIEWER is rejected by the session check.
    const viewer = await member(orgId, 'VIEWER')
    await runOnce(`Bearer ${jwt.sign({ sub: viewer.id, orgId, role: 'ADMIN', personId: viewer.person!.id, sessionVersion: viewer.sessionVersion })}`).expect(401)
    expect(await effects(orgId)).toEqual(before)
  })

  it('with the flag disabled an ADMIN keeps the existing 403 and nothing is written', async () => {
    process.env.ALLOW_MANUAL_ENFORCEMENT = 'false'
    const orgId = await newOrg()
    const admin = await member(orgId, 'ADMIN')
    await restrictedPerson(orgId)
    const before = await effects(orgId)
    const res = await runOnce(token(admin)).expect(403)
    expect(res.body.error).toBe('Manual enforcement desabilitado.')
    expect(await effects(orgId)).toEqual(before)
  })

  it('an ADMIN of org B never runs org A, and a client orgId cannot redirect the run', async () => {
    const orgA = await newOrg()
    const orgB = await newOrg()
    await restrictedPerson(orgA)
    const adminB = await member(orgB, 'ADMIN')
    const beforeA = await effects(orgA)
    await runOnce(token(adminB), `/admin/enforcement/run-once?orgId=${orgA}`).expect(403)
    await http().post('/admin/enforcement/run-once').set('Authorization', token(adminB)).send({ orgId: orgA }).expect(403)
    await runOnce(token(adminB)).expect(201) // runs org B only
    expect(await effects(orgA)).toEqual(beforeA)
    expect(await prisma.governanceRun.count({ where: { orgId: orgB } })).toBe(1)
  })
})
