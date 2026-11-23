import { INestApplication } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { Test } from '@nestjs/testing'
import { getOptionsToken } from '@nestjs/throttler'
import { PrismaClient, UserRole } from '@prisma/client'
import { randomUUID } from 'crypto'
import request from 'supertest'

import { AppModule } from '../../src/app.module'
import { ExecutionRunner } from '../../src/execution/execution.runner'
import { OperationalStateJob } from '../../src/people/operational-state.job'
import { describeRealIntegration } from './infra-guards'

/**
 * C8 PR3-3B-7 — manual administrative runs on the full AppModule (CLS, tenant middleware, real
 * persisted sessions) and PostgreSQL, with four organizations on the platform:
 * - POST /executions/runner/run-once processes the session organization once (never once per
 *   platform organization), leaves the others intact and does not reveal the platform total;
 * - POST /admin/operational-state/run-once recalculates the session organization only;
 * - the internal runner and job (no session) keep processing every organization;
 * - each authenticated attempt reaching the handler writes exactly one audit event; refusals write
 *   nothing and run nothing.
 * External effects: the WhatsApp provider is the mock default, no Stripe key is configured and the
 * organizations have no plan enabling the actions, so no charge or message leaves the process.
 */
describeRealIntegration('Manual administrative runs: organization scope and audit (PostgreSQL)', () => {
  jest.setTimeout(120000)
  const db = new PrismaClient()
  const secret = process.env.JWT_SECRET || 'manual-runs-scope-tests-only-explicit-secret'
  const jwt = new JwtService({ secret })
  const orgIds: string[] = []
  const previousEnv: Record<string, string | undefined> = {}
  const ENV = {
    JWT_SECRET: secret,
    DISABLE_EXECUTION_RUNNER: 'true',
    DISABLE_OPERATIONAL_STATE_SCHEDULE: 'true',
    DISABLE_GOVERNANCE_SCHEDULE: 'true',
    EXECUTION_CYCLE_DELAY_MS: '250',
  }
  let app: INestApplication
  let A: string
  let B: string
  const users: Record<string, any> = {}

  const RUNNER_PATH = '/executions/runner/run-once'
  const STATE_PATH = '/admin/operational-state/run-once'
  const MANUAL_ACTIONS = ['MANUAL_EXECUTION_RUNNER_RUN', 'MANUAL_OPERATIONAL_STATE_RUN']
  const pause = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms)) // > EXECUTION_CYCLE_DELAY_MS

  async function newOrg(label: string) {
    const id = randomUUID()
    orgIds.push(id)
    await db.organization.create({ data: { id, name: `Manual runs ${label}`, slug: `manual-runs-${label}-${id}` } })
    await db.organizationExecutionConfig.create({ data: { orgId: id, mode: 'automatic' } as any })
    return id
  }
  async function member(orgId: string, role: UserRole) {
    return db.user.create({
      data: { orgId, role, email: `${randomUUID()}@manual-runs.test`, active: true, password: 'test-password-hash', person: { create: { orgId, name: `Pessoa ${role}`, role: 'TECH', active: true } } },
      include: { person: true },
    })
  }
  const token = (user: any) =>
    `Bearer ${jwt.sign({ sub: user.id, orgId: user.orgId, role: user.role, personId: user.person?.id, sessionVersion: user.sessionVersion })}`
  /** A completed, uncharged service order: a runner candidate of its organization. */
  async function doneServiceOrder(orgId: string) {
    const customer = await db.customer.create({ data: { orgId, name: 'Cliente', phone: `119${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}` } })
    return db.serviceOrder.create({ data: { orgId, customerId: customer.id, title: 'OS', status: 'DONE', amountCents: 1000 } as any })
  }
  /** A person whose persisted state is stale (RESTRICTED 75) while the real risk is 0. */
  const stalePerson = (orgId: string) =>
    db.person.create({ data: { orgId, name: 'Stale', role: 'TECH', active: true, operationalRiskScore: 75, riskScore: 75, operationalState: 'RESTRICTED', operationalStateUpdatedAt: new Date() } })
  /** Everything a run (or a refused request) could write for an organization. */
  const snapshot = async (orgId: string) => ({
    charges: await db.charge.count({ where: { orgId } }),
    messages: await db.whatsAppMessage.count({ where: { orgId } }),
    timeline: await db.timelineEvent.count({ where: { orgId } }),
    audits: await db.auditEvent.count({ where: { orgId } }),
    restricted: await db.person.count({ where: { orgId, operationalState: 'RESTRICTED' } }),
  })
  const manualAudits = (orgId: string) =>
    db.auditEvent.findMany({ where: { orgId, action: { in: MANUAL_ACTIONS } }, orderBy: { createdAt: 'asc' } })
  const http = () => request(app.getHttpServer())
  const post = (path: string, auth?: string, body?: object) => {
    const req = http().post(path)
    if (auth) req.set('Authorization', auth)
    return body ? req.send(body) : req
  }
  /** Candidates the runner itself loads for one organization (explicit orgId filters, no session). */
  const candidatesOf = async (orgId: string) => ((await (app.get(ExecutionRunner) as any).loadActionCandidates(orgId)) as unknown[]).length

  beforeAll(async () => {
    for (const [key, value] of Object.entries(ENV)) {
      previousEnv[key] = process.env[key]
      process.env[key] = value
    }
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(getOptionsToken())
      .useValue([{ ttl: 60000, limit: 1000 }])
      .compile()
    app = module.createNestApplication()
    await app.init()

    A = await newOrg('a')
    B = await newOrg('b')
    // Two more organizations: on main a manual run processed the caller's organization once per platform organization.
    for (const label of ['c', 'd']) await doneServiceOrder(await newOrg(label))
    for (const role of ['ADMIN', 'MANAGER', 'STAFF', 'VIEWER'] as UserRole[]) users[`${role.toLowerCase()}A`] = await member(A, role)
    users.adminB = await member(B, 'ADMIN')
  })

  beforeEach(async () => {
    for (const orgId of [A, B]) {
      await doneServiceOrder(orgId)
      await stalePerson(orgId)
    }
    await pause()
  })

  afterAll(async () => {
    await app?.close()
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
    const where = { orgId: { in: orgIds } }
    const models = ['timelineEvent', 'auditEvent', 'whatsAppMessage', 'payment', 'charge', 'serviceOrder', 'customer', 'riskSnapshot', 'organizationExecutionConfig', 'subscription']
    for (const model of models) await (db as any)[model]?.deleteMany({ where }).catch(() => undefined)
    await db.person.updateMany({ where, data: { userId: null } as any }).catch(() => undefined)
    await db.user.deleteMany({ where })
    await db.person.deleteMany({ where })
    await db.organization.deleteMany({ where: { id: { in: orgIds } } })
    await db.$disconnect()
  })

  it('A — ADMIN A: the runner processes A once, B intact, counters of A only, platform total hidden', async () => {
    const expectedCandidates = await candidatesOf(A)
    expect(expectedCandidates).toBeGreaterThan(0)
    const b0 = await snapshot(B)
    const res = await post(RUNNER_PATH, token(users.adminA)).expect(201)
    expect(res.body.orgs).toBe(1)
    expect(res.body.totalCandidates).toBe(expectedCandidates)
    expect(await snapshot(B)).toEqual(b0)
    expect(await db.charge.count({ where: { orgId: { in: orgIds } } })).toBe(0)
    expect(await db.whatsAppMessage.count({ where: { orgId: { in: orgIds } } })).toBe(0)
  })

  it('A — overrideCooldown in the query does not change the scoped run', async () => {
    const b0 = await snapshot(B)
    const res = await post(`${RUNNER_PATH}?overrideCooldown=true`, token(users.adminA)).expect(201)
    expect(res.body.orgs).toBe(1)
    expect(await snapshot(B)).toEqual(b0)
    const [last] = (await manualAudits(A)).slice(-1)
    expect(last.metadata).toMatchObject({ requested: { overrideCooldownIgnored: true } })
  })

  it('A — ADMIN B runs only B', async () => {
    const a0 = await snapshot(A)
    const res = await post(RUNNER_PATH, token(users.adminB)).expect(201)
    expect(res.body.orgs).toBe(1)
    expect(res.body.totalCandidates).toBe(await candidatesOf(B))
    expect(await snapshot(A)).toEqual(a0)
    const [audit] = (await manualAudits(B)).slice(-1)
    expect(audit).toMatchObject({ orgId: B, action: 'MANUAL_EXECUTION_RUNNER_RUN', actorUserId: users.adminB.id, entityId: B })
  })

  it('B — ADMIN A: the operational state is recalculated for A only, B keeps its stale state', async () => {
    const restrictedB = await db.person.count({ where: { orgId: B, operationalState: 'RESTRICTED' } })
    expect(restrictedB).toBeGreaterThan(0)
    const b0 = await snapshot(B)
    await post(STATE_PATH, token(users.adminA)).expect(201)
    expect(await db.person.count({ where: { orgId: A, operationalState: 'RESTRICTED' } })).toBe(0)
    expect(await snapshot(B)).toEqual(b0)
  })

  it('C — the internal runner and job (no session) still process every organization', async () => {
    const b0 = await snapshot(B)
    const summary: any = await app.get(ExecutionRunner).runOnce()
    expect(summary.orgs).toBeGreaterThanOrEqual(4)
    expect(summary.totalCandidates).toBeGreaterThanOrEqual((await candidatesOf(A)) + (await candidatesOf(B)))
    const result = await app.get(OperationalStateJob).run()
    expect(result.changed).toBeGreaterThan(0)
    expect(await db.person.count({ where: { orgId: { in: [A, B] }, operationalState: 'RESTRICTED' } })).toBe(0)
    const b1 = await snapshot(B)
    expect(b1.timeline).toBeGreaterThan(b0.timeline)
    // Internal runs are not manual: no manual audit is written.
    expect(b1.audits).toBe(b0.audits)
  })

  it('D — exactly one audit event per manual call, with the verified author and organization', async () => {
    const before = (await manualAudits(A)).length
    const beforeB = (await manualAudits(B)).length
    await post(RUNNER_PATH, token(users.adminA)).expect(201)
    await pause()
    await post(STATE_PATH, token(users.adminA)).expect(201)
    const audits = (await manualAudits(A)).slice(before)
    expect(audits.map((a) => a.action)).toEqual(MANUAL_ACTIONS)
    for (const audit of audits) {
      expect(audit).toMatchObject({ orgId: A, actorUserId: users.adminA.id, actorPersonId: users.adminA.person.id, entityType: 'Organization', entityId: A })
      expect(audit.metadata).toMatchObject({ scope: 'organization', outcome: expect.stringMatching(/^(SUCCEEDED|COMPLETED_WITH_FAILURES|SKIPPED_CYCLE_DELAY)$/) })
      expect(JSON.stringify(audit)).not.toMatch(/Bearer|password|secret/i)
    }
    expect(audits[1].metadata).toMatchObject({ outcome: 'SUCCEEDED', counters: { evaluated: expect.any(Number), changed: expect.any(Number) } })
    // Calls by ADMIN A never write a manual audit in B.
    expect((await manualAudits(B)).length).toBe(beforeB)
  })

  it('refusals (role, missing/revoked/inactive session, foreign orgId) run nothing and audit nothing', async () => {
    const a0 = await snapshot(A)
    const b0 = await snapshot(B)
    for (const path of [RUNNER_PATH, STATE_PATH]) {
      for (const user of ['managerA', 'staffA', 'viewerA']) await post(path, token(users[user])).expect(403)
      await post(path).expect(401)
      await post(path, 'Bearer not-a-jwt').expect(401)
      await post(`${path}?orgId=${B}`, token(users.adminA)).expect(403)
      await post(path, token(users.adminA), { orgId: B }).expect(403)
    }
    // A token claiming ADMIN for a persisted VIEWER, a revoked session and a deactivated ADMIN.
    const forged = `Bearer ${jwt.sign({ sub: users.viewerA.id, orgId: A, role: 'ADMIN', personId: users.viewerA.person.id, sessionVersion: users.viewerA.sessionVersion })}`
    const revokedAdmin = await member(A, 'ADMIN')
    const revoked = token(revokedAdmin)
    await db.user.update({ where: { id: revokedAdmin.id }, data: { sessionVersion: { increment: 1 } } })
    const inactiveAdmin = await member(A, 'ADMIN')
    await db.user.update({ where: { id: inactiveAdmin.id }, data: { active: false } })
    const a1 = await snapshot(A) // the extra members add no audit/timeline rows
    for (const path of [RUNNER_PATH, STATE_PATH]) {
      await post(path, forged).expect(401)
      await post(path, revoked).expect(401)
      await post(path, token(inactiveAdmin)).expect(401)
    }
    expect(await snapshot(A)).toEqual(a1)
    expect(a1).toEqual(a0)
    expect(await snapshot(B)).toEqual(b0)
  })
})
