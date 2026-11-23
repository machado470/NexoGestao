import { INestApplication, ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { Test } from '@nestjs/testing'
import { PrismaClient, UserRole } from '@prisma/client'
import { randomUUID } from 'crypto'
import request from 'supertest'

import { AuditService } from '../../src/audit/audit.service'
import { RolesGuard } from '../../src/auth/guards/roles.guard'
import { JwtAuthGuard } from '../../src/auth/jwt-auth.guard'
import { JwtStrategy } from '../../src/auth/jwt.strategy'
import { RequestContextService } from '../../src/common/context/request-context.service'
import { ApiExceptionFilter } from '../../src/common/http/api-exception.filter'
import { CorrectiveActionsController } from '../../src/corrective-actions/corrective-actions.controller'
import { CorrectiveActionsService } from '../../src/corrective-actions/corrective-actions.service'
import { OperationalStateGuard } from '../../src/people/operational-state.guard'
import { OperationalStateService } from '../../src/people/operational-state.service'
import { PrismaService } from '../../src/prisma/prisma.service'
import { RiskService } from '../../src/risk/risk.service'
import { TimelineService } from '../../src/timeline/timeline.service'
import { describeRealIntegration } from './infra-guards'

/**
 * C8 PR3-3B-2 — closing corrective actions with the real session validation (JwtStrategy +
 * persisted session) and PostgreSQL: only ADMINs close, never their own action (also in an
 * organization with a single ADMIN), other organizations are untouched, the closing audit holds
 * the session author, and refusals write nothing. Risk recalculation and timeline are stubbed.
 */
describeRealIntegration('Corrective actions: roles, self-resolution and authorship with PostgreSQL', () => {
  jest.setTimeout(30000)
  const prisma = new PrismaClient()
  const secret = 'corrective-actions-roles-tests-only-explicit-secret'
  const jwt = new JwtService({ secret })
  const orgIds: string[] = []
  const risk = { recalculatePersonRisk: jest.fn().mockResolvedValue({ score: 0, state: 'NORMAL' }) }
  const timeline = { log: jest.fn().mockResolvedValue(undefined) }
  let app: INestApplication
  let orgId: string

  const token = (user: any) =>
    `Bearer ${jwt.sign({ sub: user.id, orgId: user.orgId, role: user.role, personId: user.person?.id, sessionVersion: user.sessionVersion })}`

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [PassportModule],
      controllers: [CorrectiveActionsController],
      providers: [
        CorrectiveActionsService,
        AuditService,
        JwtStrategy,
        JwtAuthGuard,
        RolesGuard,
        OperationalStateGuard,
        { provide: OperationalStateService, useValue: { getStatus: jest.fn().mockResolvedValue({ state: 'NORMAL', riskScore: 0 }) } },
        { provide: RiskService, useValue: risk },
        { provide: TimelineService, useValue: timeline },
        { provide: RequestContextService, useValue: { requestId: 'req-it', userId: null, personId: null } },
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: (key: string) => (key === 'JWT_SECRET' ? secret : undefined) } },
      ],
    }).compile()
    app = module.createNestApplication()
    app.useGlobalFilters(new ApiExceptionFilter())
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
    await app.init()
  })

  async function newOrg() {
    const id = randomUUID()
    orgIds.push(id)
    await prisma.organization.create({ data: { id, name: 'Corrective roles test', slug: `corrective-roles-${id}` } })
    return id
  }

  async function member(role: UserRole, org = orgId) {
    return prisma.user.create({
      data: {
        orgId: org,
        role,
        email: `${randomUUID()}@corrective-roles.test`,
        active: true,
        password: 'test-password-hash',
        person: { create: { orgId: org, name: `Pessoa ${role}`, role: 'TECH', active: true } },
      },
      include: { person: true },
    })
  }

  const openAction = (personId: string, reason = 'Risco crítico identificado em avaliação') =>
    prisma.correctiveAction.create({ data: { personId, reason, status: 'OPEN' } })

  const state = async (actionId: string) => ({
    action: await prisma.correctiveAction.findUnique({ where: { id: actionId }, select: { status: true, resolvedAt: true } }),
    audits: await prisma.auditEvent.count({ where: { orgId: { in: orgIds }, action: 'CORRECTIVE_ACTION_RESOLVED' } }),
  })

  beforeEach(async () => {
    orgId = await newOrg()
    jest.clearAllMocks()
  })

  afterAll(async () => {
    await app?.close()
    await prisma.auditEvent.deleteMany({ where: { orgId: { in: orgIds } } })
    await prisma.correctiveAction.deleteMany({ where: { person: { orgId: { in: orgIds } } } })
    await prisma.person.deleteMany({ where: { orgId: { in: orgIds } } })
    await prisma.user.deleteMany({ where: { orgId: { in: orgIds } } })
    await prisma.organization.deleteMany({ where: { id: { in: orgIds } } })
    await prisma.$disconnect()
  })

  const http = () => request(app.getHttpServer())
  const resolve = (auth: string, id: string, body?: object) => http().post(`/corrective-actions/${id}/resolve`).set('Authorization', auth).send(body ?? {})
  const reassess = (auth: string, personId: string) => http().post(`/corrective-actions/person/${personId}/reassess`).set('Authorization', auth)

  it('an ADMIN closes an action of another person; the persisted audit holds the session author', async () => {
    const admin = await member('ADMIN')
    const staff = await member('STAFF')
    const action = await openAction(staff.person!.id)
    await resolve(token(admin), action.id, { actorUserId: 'forged-user', actorPersonId: 'forged-person', role: 'VIEWER' }).expect(201)
    expect(await prisma.correctiveAction.findUnique({ where: { id: action.id } })).toMatchObject({ status: 'DONE', resolvedAt: expect.any(Date) })
    const events = await prisma.auditEvent.findMany({ where: { orgId } })
    expect(events).toEqual([
      expect.objectContaining({ orgId, action: 'CORRECTIVE_ACTION_RESOLVED', actorUserId: admin.id, actorPersonId: admin.person!.id, entityType: 'CORRECTIVE_ACTION', entityId: action.id }),
    ])
    expect(JSON.stringify(events)).not.toContain('forged')
    expect(risk.recalculatePersonRisk).toHaveBeenCalledWith(staff.person!.id, expect.any(String))
  })

  it('an ADMIN reassesses another person: their latest OPEN action is closed', async () => {
    const admin = await member('ADMIN')
    const staff = await member('STAFF')
    const action = await openAction(staff.person!.id)
    const res = await reassess(token(admin), staff.person!.id).expect(201)
    expect(res.body).toEqual({ reassessed: true, resolved: true, correctiveActionId: action.id })
    expect((await prisma.correctiveAction.findUnique({ where: { id: action.id } }))!.status).toBe('DONE')
  })

  it('a single ADMIN cannot close their own action (resolve or reassess); it stays OPEN with no audit', async () => {
    const onlyAdmin = await member('ADMIN')
    await member('STAFF')
    const own = await openAction(onlyAdmin.person!.id, 'Governança')
    const before = await state(own.id)
    await resolve(token(onlyAdmin), own.id).expect(403)
    await reassess(token(onlyAdmin), onlyAdmin.person!.id).expect(403)
    expect(await state(own.id)).toEqual(before)
    expect(before.action).toEqual({ status: 'OPEN', resolvedAt: null })
    expect(risk.recalculatePersonRisk).not.toHaveBeenCalled()
    expect(timeline.log).not.toHaveBeenCalled()
  })

  it('an action of an ADMIN can be closed by another ADMIN of the same organization', async () => {
    const adminWithAction = await member('ADMIN')
    const otherAdmin = await member('ADMIN')
    const action = await openAction(adminWithAction.person!.id)
    await resolve(token(otherAdmin), action.id).expect(201)
    expect((await prisma.correctiveAction.findUnique({ where: { id: action.id } }))!.status).toBe('DONE')
  })

  it.each(['MANAGER', 'STAFF', 'VIEWER'] as UserRole[])('%s gets 403 on resolve and reassess, with no write', async (role) => {
    const user = await member(role)
    const colleague = await member('STAFF')
    const ownAction = await openAction(user.person!.id)
    const colleagueAction = await openAction(colleague.person!.id)
    await resolve(token(user), ownAction.id, { role: 'ADMIN' }).expect(403)
    await resolve(token(user), colleagueAction.id).expect(403)
    await reassess(token(user), colleague.person!.id).expect(403)
    await reassess(token(user), user.person!.id).expect(403)
    for (const a of [ownAction, colleagueAction]) expect((await state(a.id)).action).toEqual({ status: 'OPEN', resolvedAt: null })
    expect(await prisma.auditEvent.count({ where: { orgId } })).toBe(0)
    expect(risk.recalculatePersonRisk).not.toHaveBeenCalled()
  })

  it('an ADMIN of another organization changes nothing; foreign and missing ids answer alike', async () => {
    const staffA = await member('STAFF')
    const actionA = await openAction(staffA.person!.id)
    const orgB = await newOrg()
    const adminB = await member('ADMIN', orgB)
    const foreign = await resolve(token(adminB), actionA.id).expect(201)
    const missing = await resolve(token(adminB), randomUUID()).expect(201)
    expect(foreign.text).toBe('')
    expect(missing.text).toBe(foreign.text)
    await reassess(token(adminB), staffA.person!.id).expect(201, { reassessed: true, resolved: false })
    await reassess(token(adminB), randomUUID()).expect(201, { reassessed: true, resolved: false })
    expect((await state(actionA.id)).action).toEqual({ status: 'OPEN', resolvedAt: null })
    expect(await prisma.auditEvent.count({ where: { orgId: { in: [orgId, orgB] } } })).toBe(0)
  })

  it('a revoked session and missing credentials get 401 with no write', async () => {
    const admin = await member('ADMIN')
    const staff = await member('STAFF')
    const action = await openAction(staff.person!.id)
    const stale = token(admin)
    await prisma.user.update({ where: { id: admin.id }, data: { sessionVersion: { increment: 1 } } })
    await resolve(stale, action.id).expect(401)
    await http().post(`/corrective-actions/${action.id}/resolve`).expect(401)
    expect((await state(action.id)).action).toEqual({ status: 'OPEN', resolvedAt: null })
  })
})
