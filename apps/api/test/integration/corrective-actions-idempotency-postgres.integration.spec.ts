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
import { OperationalStateRepository } from '../../src/people/operational-state.repository'
import { OperationalStateService } from '../../src/people/operational-state.service'
import { PrismaService } from '../../src/prisma/prisma.service'
import { RiskService } from '../../src/risk/risk.service'
import { TemporalRiskService } from '../../src/risk/temporal-risk.service'
import { TimelineService } from '../../src/timeline/timeline.service'
import { WebhookDispatcher } from '../../src/webhooks/webhook.dispatcher'
import { describeRealIntegration } from './infra-guards'

/**
 * C8 PR3-3B-3 (CA-4) — closing a corrective action is idempotent and race-free with PostgreSQL.
 * Real risk recalculation, operational state and timeline (all persisted), real audit, real session.
 * Only an OPEN action is closed, by exactly one of many concurrent or repeated requests; the others
 * have no effect (no resolvedAt change, audit, timeline event or risk snapshot).
 *
 * CA-5 (minimal): the update and its audit are one transaction. An audit failure rolls the update
 * back (the action stays OPEN) and a retry closes and audits it once. The risk recalculation and the
 * timeline run after the commit; a failure there is documented below (not repaired by a retry).
 */
describeRealIntegration('Corrective actions: idempotent and race-free closing with PostgreSQL', () => {
  jest.setTimeout(60000)
  const prisma = new PrismaClient()
  const secret = 'corrective-idempotency-tests-only-explicit-secret'
  const jwt = new JwtService({ secret })
  const orgIds: string[] = []
  const requestContext = { requestId: 'req-ca4', userId: null, personId: null, orgId: null, correlationId: 'req-ca4', getAll: () => ({}) }
  let failNextAudit = false
  let failNextRecalculation = false
  let missNextReread = false
  /** Real PostgreSQL client whose interactive transactions fail the next audit write when asked. */
  const db: any = new Proxy(prisma, {
    get(target, prop) {
      if (prop !== '$transaction') return (target as any)[prop]
      return (fn: any, ...rest: any[]) =>
        typeof fn !== 'function'
          ? (target as any).$transaction(fn, ...rest)
          : target.$transaction(
              (tx) =>
                fn(
                  new Proxy(tx, {
                    get(t, key) {
                      if (key === 'correctiveAction' && missNextReread) {
                        // The re-read after the conditional update returns null once.
                        return new Proxy(t.correctiveAction, {
                          get(delegate, method) {
                            const real = Reflect.get(delegate, method)
                            if (method !== 'findFirst') return typeof real === 'function' ? real.bind(delegate) : real
                            return async () => {
                              missNextReread = false
                              return null
                            }
                          },
                        })
                      }
                      if (key !== 'auditEvent' || !failNextAudit) return (t as any)[key]
                      return {
                        ...t.auditEvent,
                        create: async () => {
                          failNextAudit = false
                          throw new Error('simulated audit storage failure')
                        },
                      }
                    },
                  }),
                ),
              ...rest,
            )
    },
  })
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
        RiskService,
        TemporalRiskService,
        TimelineService,
        OperationalStateService,
        OperationalStateRepository,
        JwtStrategy,
        JwtAuthGuard,
        RolesGuard,
        OperationalStateGuard,
        { provide: WebhookDispatcher, useValue: { dispatchTimelineEvent: jest.fn().mockResolvedValue(undefined) } },
        { provide: RequestContextService, useValue: requestContext },
        { provide: PrismaService, useValue: db },
        { provide: ConfigService, useValue: { get: (key: string) => (key === 'JWT_SECRET' ? secret : undefined) } },
      ],
    }).compile()
    // Controlled failure after the commit: the next risk recalculation throws once.
    const risk = module.get(RiskService)
    const realRecalculate = risk.recalculatePersonRisk.bind(risk)
    risk.recalculatePersonRisk = async (...args: Parameters<RiskService['recalculatePersonRisk']>) => {
      if (failNextRecalculation) {
        failNextRecalculation = false
        throw new Error('simulated risk recalculation failure')
      }
      return realRecalculate(...args)
    }
    app = module.createNestApplication()
    app.useGlobalFilters(new ApiExceptionFilter())
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
    await app.init()
  })

  async function newOrg() {
    const id = randomUUID()
    orgIds.push(id)
    await prisma.organization.create({ data: { id, name: 'Corrective idempotency test', slug: `corrective-idem-${id}` } })
    return id
  }

  async function member(role: UserRole, org = orgId) {
    return prisma.user.create({
      data: {
        orgId: org,
        role,
        email: `${randomUUID()}@corrective-idempotency.test`,
        active: true,
        password: 'test-password-hash',
        person: { create: { orgId: org, name: `Pessoa ${role}`, role: 'TECH', active: true } },
      },
      include: { person: true },
    })
  }

  const action = (personId: string, status: 'OPEN' | 'AWAITING_REASSESSMENT' | 'DONE' = 'OPEN', createdAt?: Date) =>
    prisma.correctiveAction.create({ data: { personId, reason: 'Risco crítico identificado em avaliação', status, ...(createdAt ? { createdAt } : {}) } })

  /** Every persisted effect of closing actions of a person. */
  const effects = async (personId: string) => ({
    audits: await prisma.auditEvent.count({ where: { orgId, action: 'CORRECTIVE_ACTION_RESOLVED' } }),
    timeline: await prisma.timelineEvent.count({ where: { orgId, personId, action: 'CORRECTIVE_ACTION_RESOLVED' } }),
    snapshots: await prisma.riskSnapshot.count({ where: { personId } }),
  })
  const row = (id: string) => prisma.correctiveAction.findUniqueOrThrow({ where: { id }, select: { status: true, resolvedAt: true } })

  beforeEach(async () => {
    orgId = await newOrg()
    failNextAudit = false
    failNextRecalculation = false
    missNextReread = false
  })

  afterAll(async () => {
    await app?.close()
    const people = { orgId: { in: orgIds } }
    await prisma.auditEvent.deleteMany({ where: { orgId: { in: orgIds } } })
    await prisma.timelineEvent.deleteMany({ where: { orgId: { in: orgIds } } })
    await prisma.riskSnapshot.deleteMany({ where: { person: people } })
    await prisma.correctiveAction.deleteMany({ where: { person: people } })
    await prisma.person.deleteMany({ where: people })
    await prisma.user.deleteMany({ where: { orgId: { in: orgIds } } })
    await prisma.organization.deleteMany({ where: { id: { in: orgIds } } })
    await prisma.$disconnect()
  })

  const http = () => request(app.getHttpServer())
  const resolve = (auth: string, id: string) => http().post(`/corrective-actions/${id}/resolve`).set('Authorization', auth)
  const reassess = (auth: string, personId: string) => http().post(`/corrective-actions/person/${personId}/reassess`).set('Authorization', auth)

  it('the first close of an OPEN action works and has exactly one of each effect', async () => {
    const admin = await member('ADMIN')
    const staff = await member('STAFF')
    const open = await action(staff.person!.id)
    const res = await resolve(token(admin), open.id).expect(201)
    expect(res.body).toMatchObject({ id: open.id, status: 'DONE' })
    expect(await row(open.id)).toEqual({ status: 'DONE', resolvedAt: expect.any(Date) })
    expect(await effects(staff.person!.id)).toEqual({ audits: 1, timeline: 1, snapshots: 1 })
  })

  it('a second close changes nothing: same resolvedAt, no extra audit, timeline event or risk snapshot', async () => {
    const admin = await member('ADMIN')
    const staff = await member('STAFF')
    const open = await action(staff.person!.id)
    await resolve(token(admin), open.id).expect(201)
    const first = await row(open.id)
    const firstEffects = await effects(staff.person!.id)
    const again = await resolve(token(admin), open.id).expect(201)
    expect(again.text).toBe('') // same answer as a missing or foreign id (existing contract)
    expect(await row(open.id)).toEqual(first)
    expect(await effects(staff.person!.id)).toEqual(firstEffects)
  })

  it('an action already DONE (closed elsewhere) is not touched and produces no effect', async () => {
    const admin = await member('ADMIN')
    const staff = await member('STAFF')
    const done = await prisma.correctiveAction.create({ data: { personId: staff.person!.id, reason: 'x', status: 'DONE', resolvedAt: new Date('2026-01-01T00:00:00.000Z') } })
    await resolve(token(admin), done.id).expect(201, '')
    expect(await row(done.id)).toEqual({ status: 'DONE', resolvedAt: new Date('2026-01-01T00:00:00.000Z') })
    expect(await effects(staff.person!.id)).toEqual({ audits: 0, timeline: 0, snapshots: 0 })
  })

  it('an AWAITING_REASSESSMENT action is not closed in this step', async () => {
    const admin = await member('ADMIN')
    const staff = await member('STAFF')
    const awaiting = await action(staff.person!.id, 'AWAITING_REASSESSMENT')
    await resolve(token(admin), awaiting.id).expect(201, '')
    expect(await row(awaiting.id)).toEqual({ status: 'AWAITING_REASSESSMENT', resolvedAt: null })
    expect(await effects(staff.person!.id)).toEqual({ audits: 0, timeline: 0, snapshots: 0 })
  })

  it('eight concurrent closes of the same action: exactly one effective update and one of each effect', async () => {
    const admin = await member('ADMIN')
    const staff = await member('STAFF')
    const open = await action(staff.person!.id)
    const auth = token(admin)
    const responses = await Promise.all(Array.from({ length: 8 }, () => resolve(auth, open.id)))
    expect(responses.map((r) => r.status)).toEqual(Array(8).fill(201))
    const winners = responses.filter((r) => r.body?.id === open.id)
    expect(winners).toHaveLength(1)
    expect(responses.filter((r) => r.text === '')).toHaveLength(7)
    expect((await row(open.id)).resolvedAt!.toISOString()).toBe(winners[0].body.resolvedAt)
    expect(await effects(staff.person!.id)).toEqual({ audits: 1, timeline: 1, snapshots: 1 })
  })

  it('eight concurrent reassess calls for a person with one OPEN action close it once', async () => {
    const admin = await member('ADMIN')
    const staff = await member('STAFF')
    const open = await action(staff.person!.id)
    const auth = token(admin)
    const responses = await Promise.all(Array.from({ length: 8 }, () => reassess(auth, staff.person!.id)))
    expect(responses.map((r) => r.status)).toEqual(Array(8).fill(201))
    expect(responses.filter((r) => r.body.resolved === true)).toHaveLength(1)
    for (const r of responses.filter((x) => x.body.resolved === false)) expect(r.body.reassessed).toBe(true)
    expect((await row(open.id)).status).toBe('DONE')
    expect(await effects(staff.person!.id)).toEqual({ audits: 1, timeline: 1, snapshots: 1 })
  })

  it('sequential reassess keeps its semantics: each call closes the next most recent OPEN action', async () => {
    const admin = await member('ADMIN')
    const staff = await member('STAFF')
    const older = await action(staff.person!.id, 'OPEN', new Date('2026-11-01T00:00:00.000Z'))
    const newer = await action(staff.person!.id, 'OPEN', new Date('2026-11-02T00:00:00.000Z'))
    await reassess(token(admin), staff.person!.id).expect(201, { reassessed: true, resolved: true, correctiveActionId: newer.id })
    await reassess(token(admin), staff.person!.id).expect(201, { reassessed: true, resolved: true, correctiveActionId: older.id })
    await reassess(token(admin), staff.person!.id).expect(201, { reassessed: true, resolved: false })
    expect(await effects(staff.person!.id)).toMatchObject({ audits: 2, timeline: 2 })
  })

  it('isolation, self-resolution and roles are unchanged', async () => {
    const admin = await member('ADMIN')
    const staff = await member('STAFF')
    const ownAction = await action(admin.person!.id)
    const staffAction = await action(staff.person!.id)
    await resolve(token(admin), ownAction.id).expect(403)
    await resolve(token(staff), staffAction.id).expect(403)
    await http().post(`/corrective-actions/${staffAction.id}/resolve`).expect(401)
    const orgB = await newOrg()
    const adminB = await member('ADMIN', orgB)
    await resolve(token(adminB), staffAction.id).expect(201, '')
    for (const a of [ownAction, staffAction]) expect(await row(a.id)).toEqual({ status: 'OPEN', resolvedAt: null })
    expect(await effects(staff.person!.id)).toEqual({ audits: 0, timeline: 0, snapshots: 0 })
  })

  // CA-5 (minimal): the update and its audit are atomic.
  it('an audit failure rolls the whole transaction back: the action stays OPEN, with no resolvedAt, timeline or snapshot', async () => {
    const admin = await member('ADMIN')
    const staff = await member('STAFF')
    const open = await action(staff.person!.id)
    failNextAudit = true
    const failed = await resolve(token(admin), open.id).expect(500)
    expect(failed.body).toMatchObject({ code: 'INTERNAL_ERROR' })
    expect(await row(open.id)).toEqual({ status: 'OPEN', resolvedAt: null })
    expect(await effects(staff.person!.id)).toEqual({ audits: 0, timeline: 0, snapshots: 0 })
  })

  it('an updated action not found on re-read inside the transaction rolls back (no DONE without audit)', async () => {
    const admin = await member('ADMIN')
    const staff = await member('STAFF')
    const open = await action(staff.person!.id)
    missNextReread = true
    await resolve(token(admin), open.id).expect(500)
    expect(missNextReread).toBe(false) // the injected null was consumed after the update
    expect(await row(open.id)).toEqual({ status: 'OPEN', resolvedAt: null })
    expect(await effects(staff.person!.id)).toEqual({ audits: 0, timeline: 0, snapshots: 0 })
    // A retry then closes and audits it once.
    await resolve(token(admin), open.id).expect(201)
    expect(await effects(staff.person!.id)).toEqual({ audits: 1, timeline: 1, snapshots: 1 })
  })

  it('a retry after an audit failure closes and audits the action exactly once', async () => {
    const admin = await member('ADMIN')
    const staff = await member('STAFF')
    const open = await action(staff.person!.id)
    failNextAudit = true
    await resolve(token(admin), open.id).expect(500)
    const retry = await resolve(token(admin), open.id).expect(201)
    expect(retry.body).toMatchObject({ id: open.id, status: 'DONE' })
    expect(await row(open.id)).toEqual({ status: 'DONE', resolvedAt: expect.any(Date) })
    expect(await effects(staff.person!.id)).toEqual({ audits: 1, timeline: 1, snapshots: 1 })
    const [audit] = await prisma.auditEvent.findMany({ where: { orgId, action: 'CORRECTIVE_ACTION_RESOLVED' } })
    expect(audit).toMatchObject({ orgId, actorUserId: admin.id, actorPersonId: admin.person!.id, personId: null, entityType: 'CORRECTIVE_ACTION', entityId: open.id, context: 'Ação corretiva resolvida', metadata: { requestId: 'req-ca4', personId: staff.person!.id } })
    // A further retry is a no-op.
    await resolve(token(admin), open.id).expect(201, '')
    expect(await effects(staff.person!.id)).toEqual({ audits: 1, timeline: 1, snapshots: 1 })
  })

  it('an audit failure during eight concurrent closes: the action is closed and audited once by the others', async () => {
    const admin = await member('ADMIN')
    const staff = await member('STAFF')
    const open = await action(staff.person!.id)
    failNextAudit = true
    const responses = await Promise.all(Array.from({ length: 8 }, () => resolve(token(admin), open.id)))
    expect(responses.filter((r) => r.status === 500).length).toBeLessThanOrEqual(1)
    expect(responses.filter((r) => r.body?.id === open.id)).toHaveLength(1)
    expect((await row(open.id)).status).toBe('DONE')
    expect(await effects(staff.person!.id)).toEqual({ audits: 1, timeline: 1, snapshots: 1 })
  })

  // Documented, not fixed here: the recalculation and timeline run after the commit.
  it('documented: a risk recalculation failure after the commit leaves the action DONE and audited, without timeline or snapshot; a retry does not redo them', async () => {
    const admin = await member('ADMIN')
    const staff = await member('STAFF')
    const open = await action(staff.person!.id)
    failNextRecalculation = true
    await resolve(token(admin), open.id).expect(500)
    const afterFailure = await row(open.id)
    expect(afterFailure.status).toBe('DONE')
    expect(await effects(staff.person!.id)).toEqual({ audits: 1, timeline: 0, snapshots: 0 })
    await resolve(token(admin), open.id).expect(201, '')
    expect(await row(open.id)).toEqual(afterFailure)
    expect(await effects(staff.person!.id)).toEqual({ audits: 1, timeline: 0, snapshots: 0 })
  })
})
