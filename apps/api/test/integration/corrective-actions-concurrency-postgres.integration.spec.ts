import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'

import { AssessmentsService } from '../../src/assessments/assessments.service'
import { AuditService } from '../../src/audit/audit.service'
import { createCorrectiveActionAtomically } from '../../src/corrective-actions/corrective-action-creation'
import { CorrectiveActionsService } from '../../src/corrective-actions/corrective-actions.service'
import { EnforcementEngineService } from '../../src/governance/enforcement-engine.service'
import { EnforcementPolicyService } from '../../src/governance/enforcement-policy.service'
import { OperationalStateRepository } from '../../src/people/operational-state.repository'
import { OperationalStateService } from '../../src/people/operational-state.service'
import { RiskService } from '../../src/risk/risk.service'
import { TemporalRiskService } from '../../src/risk/temporal-risk.service'
import { TimelineService } from '../../src/timeline/timeline.service'
import { describeRealIntegration } from './infra-guards'

/**
 * C8 PR3-3B-5 — atomic creation of corrective actions with PostgreSQL, two independent PrismaClients
 * (two "instances") and the real engine, assessments, risk, timeline and audit.
 *
 * Deterministic leader/follower barrier (no sleeps): the leader is paused right after its dedup
 * query; the follower starts; the leader is released only when the follower is either waiting on
 * the transactional advisory lock (new protocol) or has run its own dedup query (old code). Old
 * code then creates twice; the new protocol serializes the two callers.
 */
describeRealIntegration('Corrective actions: atomic creation under concurrency with PostgreSQL', () => {
  jest.setTimeout(60000)
  const ctx: any = { requestId: 'req-conc', userId: null, personId: null, orgId: null, correlationId: 'req-conc', getAll: () => ({}) }
  const raw = [new PrismaClient(), new PrismaClient()]
  const db = raw[0]
  const orgIds: string[] = []

  /** Barrier state shared by both clients. */
  const barrier = {
    armed: false,
    leaderClient: -1,
    dedups: [0, 0],
    pausedLeader: null as null | (() => void),
    leaderReached: null as null | (() => void),
    failNextCreate: false,
  }

  const isDedup = (where: any) => where && ('status' in where || 'reason' in where)
  /** Wraps a PrismaClient so the dedup query of the leader can be held (top level and inside transactions). */
  function instrument(client: PrismaClient, index: number): any {
    const wrapCorrective = (delegate: any) =>
      new Proxy(delegate, {
        get(target, method) {
          const real = Reflect.get(target, method)
          if (method === 'create') {
            return async (args: any) => {
              if (barrier.failNextCreate) {
                barrier.failNextCreate = false
                throw new Error('simulated failure inside the creation transaction')
              }
              return real.call(target, args)
            }
          }
          if (method !== 'findFirst') return typeof real === 'function' ? real.bind(target) : real
          return async (args: any) => {
            const result = await real.call(target, args)
            if (barrier.armed && isDedup(args?.where)) {
              barrier.dedups[index]++
              if (index === barrier.leaderClient && barrier.dedups[index] === 1) {
                barrier.leaderReached?.()
                await new Promise<void>((resolve) => { barrier.pausedLeader = resolve })
              }
            }
            return result
          }
        },
      })
    const wrapTx = (tx: any) => new Proxy(tx, { get: (t, k) => (k === 'correctiveAction' ? wrapCorrective(t.correctiveAction) : (t as any)[k]) })
    return new Proxy(client, {
      get(target, prop) {
        if (prop === 'correctiveAction') return wrapCorrective(target.correctiveAction)
        if (prop === '$transaction') {
          return (fn: any, ...rest: any[]) => (typeof fn === 'function' ? target.$transaction((tx) => fn(wrapTx(tx)), ...rest) : (target as any).$transaction(fn, ...rest))
        }
        const value = (target as any)[prop]
        return typeof value === 'function' ? value.bind(target) : value
      },
    })
  }

  function stack(client: any) {
    const timeline = new TimelineService(client, ctx, { dispatchTimelineEvent: async () => undefined } as any)
    const temporal = new TemporalRiskService(client)
    const repository = new OperationalStateRepository(client)
    const risk = new RiskService(client, temporal, timeline)
    const opState = new OperationalStateService(temporal, repository, timeline, client)
    const audit = new AuditService(client)
    const corrective = new CorrectiveActionsService(client, timeline, opState, risk, audit, ctx)
    return {
      client,
      engine: new EnforcementEngineService(client, new EnforcementPolicyService(), timeline, repository, temporal),
      assessments: new AssessmentsService(client, risk, audit, corrective, timeline),
      corrective,
    }
  }
  const A = stack(instrument(raw[0], 0))
  const B = stack(instrument(raw[1], 1))

  const lockWaiters = async () => Number((await db.$queryRawUnsafe<any[]>("select count(*)::int as n from pg_locks where locktype = 'advisory' and not granted"))[0].n)
  const advisoryHeld = async () => Number((await db.$queryRawUnsafe<any[]>("select count(*)::int as n from pg_locks where locktype = 'advisory' and granted and objid <> 910077"))[0].n)
  async function until(condition: () => Promise<boolean>, label: string) {
    const deadline = Date.now() + 15000
    while (!(await condition())) {
      if (Date.now() > deadline) throw new Error(`barrier timeout: ${label}`)
      await new Promise((r) => setImmediate(r))
    }
  }
  /** Runs leader (client index 0 or 1) until its dedup, starts the follower, then releases the leader. */
  async function race<T, U>(leaderIndex: number, leader: () => Promise<T>, follower: () => Promise<U>): Promise<[T, U]> {
    barrier.armed = true
    barrier.leaderClient = leaderIndex
    barrier.dedups = [0, 0]
    const reached = new Promise<void>((resolve) => { barrier.leaderReached = resolve })
    const leaderRun = leader()
    await reached
    const followerRun = follower()
    const followerIndex = 1 - leaderIndex
    await until(async () => barrier.dedups[followerIndex] > 0 || (await lockWaiters()) > 0, 'follower reaches dedup or waits on the lock')
    barrier.pausedLeader?.()
    const result = await Promise.all([leaderRun, followerRun])
    barrier.armed = false
    return result
  }

  async function newOrg() {
    const id = randomUUID()
    orgIds.push(id)
    await db.organization.create({ data: { id, name: 'Corrective concurrency', slug: `corrective-conc-${id}` } })
    return id
  }
  /** Real risk 70 (RESTRICTED) that stays RESTRICTED after one more completed assignment: avg progress 25 (+60), 2 critical events (+10). */
  async function restricted(orgId: string) {
    const p = await db.person.create({ data: { orgId, name: 'Pessoa', role: 'TECH', active: true, operationalRiskScore: 70, riskScore: 70, operationalState: 'RESTRICTED', operationalStateUpdatedAt: new Date() } })
    for (let i = 0; i < 3; i++) {
      const t = await db.track.create({ data: { orgId, slug: `z-${randomUUID()}`, title: 't', status: 'ACTIVE', version: 1 } })
      await db.assignment.create({ data: { personId: p.id, trackId: t.id, progress: 0 } })
    }
    await db.timelineEvent.createMany({ data: [1, 2].map(() => ({ orgId, personId: p.id, action: 'APPOINTMENT_CANCELLED' })) })
    return p
  }
  const plainPerson = (orgId: string, name = 'Pessoa') => db.person.create({ data: { orgId, name, role: 'TECH', active: true } })
  async function completedAssignment(orgId: string, personId: string) {
    const t = await db.track.create({ data: { orgId, slug: `c-${randomUUID()}`, title: 'Trilha', status: 'ACTIVE', version: 1 } })
    return db.assignment.create({ data: { personId, trackId: t.id, progress: 100 } })
  }
  const active = (personId: string) => db.correctiveAction.count({ where: { personId, status: { in: ['OPEN', 'AWAITING_REASSESSMENT'] } } })
  const audits = (personId: string, action: string) => db.auditEvent.count({ where: { personId, action } })
  const timelineCount = (personId: string, action: string) => db.timelineEvent.count({ where: { personId, action } })
  const critical = (svc: any, orgId: string, assignmentId: string, adminId: string, score = 10) =>
    svc.assessments.submit({ assignmentId, score, orgId, actor: { userId: 'u-admin', personId: adminId } })

  afterAll(async () => {
    const people = { orgId: { in: orgIds } }
    await db.auditEvent.deleteMany({ where: { orgId: { in: orgIds } } })
    await db.timelineEvent.deleteMany({ where: { orgId: { in: orgIds } } })
    await db.riskSnapshot.deleteMany({ where: { person: people } })
    await db.assessment.deleteMany({ where: { person: people } })
    await db.correctiveAction.deleteMany({ where: { person: people } })
    await db.assignment.deleteMany({ where: { person: people } })
    await db.track.deleteMany({ where: { orgId: { in: orgIds } } })
    await db.person.deleteMany({ where: people })
    await db.organization.deleteMany({ where: { id: { in: orgIds } } })
    await Promise.all(raw.map((c) => c.$disconnect()))
  })

  it('A — two concurrent engine runs (two instances): one action, one enforcement event', async () => {
    const orgId = await newOrg()
    const p = await restricted(orgId)
    const [r1, r2] = await race(0, () => A.engine.runForOrg(orgId), () => B.engine.runForOrg(orgId))
    expect(r1.correctivesCreated + r2.correctivesCreated).toBe(1)
    expect(await active(p.id)).toBe(1)
    expect(await timelineCount(p.id, 'OPERATIONAL_STATE_ENFORCED')).toBe(1)
  })

  it('B — two concurrent critical assessments: one action, one creation audit, the other audited as duplicate', async () => {
    const orgId = await newOrg()
    const p = await plainPerson(orgId)
    const admin = await plainPerson(orgId, 'Admin')
    const [x, y] = [await completedAssignment(orgId, p.id), await completedAssignment(orgId, p.id)]
    await race(0, () => critical(A, orgId, x.id, admin.id), () => critical(B, orgId, y.id, admin.id, 5))
    expect(await active(p.id)).toBe(1)
    expect(await audits(p.id, 'CORRECTIVE_ACTION_CREATED')).toBe(1)
    expect(await audits(p.id, 'CORRECTIVE_ACTION_SKIPPED_DUPLICATE')).toBe(1)
    expect(await timelineCount(p.id, 'CORRECTIVE_ACTION_CREATED')).toBe(1)
    expect(await db.assessment.count({ where: { personId: p.id } })).toBe(2) // both assessments are kept
  })

  describe('C — engine and assessment at the same time: same result as a valid serial order', () => {
    it('engine first: 2 actions, as in the serial order engine → assessment (the module rules differ)', async () => {
      const orgId = await newOrg()
      const p = await restricted(orgId)
      const admin = await plainPerson(orgId, 'Admin')
      const asg = await completedAssignment(orgId, p.id)
      await race(0, () => A.engine.runForOrg(orgId), () => critical(B, orgId, asg.id, admin.id))
      expect(await active(p.id)).toBe(2)
      const reasons = (await db.correctiveAction.findMany({ where: { personId: p.id }, select: { reason: true } })).map((r) => r.reason).sort()
      expect(reasons).toEqual(['RESTRICTED: risco=70 >= 70.', 'Risco crítico identificado em avaliação'])
    })

    it('assessment first: 1 action, as in the serial order assessment → engine', async () => {
      const orgId = await newOrg()
      const p = await restricted(orgId)
      const admin = await plainPerson(orgId, 'Admin')
      const asg = await completedAssignment(orgId, p.id)
      await race(0, () => critical(A, orgId, asg.id, admin.id), () => B.engine.runForOrg(orgId))
      expect(await active(p.id)).toBe(1)
    })
  })

  it('D — two organizations (and two people): locks are independent and nothing crosses organizations', async () => {
    const [o1, o2] = [await newOrg(), await newOrg()]
    const [p1, p2] = [await restricted(o1), await restricted(o2)]
    // The leader (org 1) is held inside its transaction, with its lock; org 2 must finish meanwhile.
    barrier.armed = true
    barrier.leaderClient = 0
    barrier.dedups = [0, 0]
    const reached = new Promise<void>((resolve) => { barrier.leaderReached = resolve })
    const leaderRun = A.engine.runForOrg(o1)
    await reached
    const other = await B.engine.runForOrg(o2) // completes while org 1 still holds its lock
    expect(other.correctivesCreated).toBe(1)
    expect(await lockWaiters()).toBe(0)
    barrier.pausedLeader?.()
    await leaderRun
    barrier.armed = false
    expect([await active(p1.id), await active(p2.id)]).toEqual([1, 1])
    expect(await db.correctiveAction.count({ where: { personId: { in: [p1.id, p2.id] }, person: { orgId: { notIn: [o1, o2] } } } })).toBe(0)
    // A foreign person is never created for: the helper re-checks the person in the organization.
    expect(await createCorrectiveActionAtomically(raw[0], { orgId: o1, personId: p2.id, reason: 'x', duplicateWhere: {} })).toEqual({ outcome: 'PERSON_NOT_IN_ORGANIZATION', created: false })
  })

  it('E — a failure inside the transaction rolls back, releases the lock, and a retry succeeds once', async () => {
    const orgId = await newOrg()
    const p = await restricted(orgId)
    barrier.failNextCreate = true
    await expect(A.engine.runForOrg(orgId)).rejects.toThrow('simulated failure inside the creation transaction')
    expect(await active(p.id)).toBe(0)
    expect(await advisoryHeld()).toBe(0) // transaction-scoped lock released by the rollback
    const retry = await B.engine.runForOrg(orgId)
    expect(retry.correctivesCreated).toBe(1)
    expect(await active(p.id)).toBe(1)
    expect(await advisoryHeld()).toBe(0)
  })

  describe('F — legitimate actions are still created', () => {
    it('a critical assessment more than 24h after the previous one (still OPEN) creates a second action', async () => {
      const orgId = await newOrg()
      const p = await plainPerson(orgId)
      const admin = await plainPerson(orgId, 'Admin')
      await critical(A, orgId, (await completedAssignment(orgId, p.id)).id, admin.id)
      await db.correctiveAction.updateMany({ where: { personId: p.id }, data: { createdAt: new Date(Date.now() - 25 * 3600 * 1000) } })
      await critical(B, orgId, (await completedAssignment(orgId, p.id)).id, admin.id)
      expect(await active(p.id)).toBe(2)
    })

    it('different people of the same organization at the same time each get their action (no shared lock)', async () => {
      const orgId = await newOrg()
      const admin = await plainPerson(orgId, 'Admin')
      const [p1, p2] = [await plainPerson(orgId, 'P1'), await plainPerson(orgId, 'P2')]
      const [x, y] = [await completedAssignment(orgId, p1.id), await completedAssignment(orgId, p2.id)]
      barrier.armed = true
      barrier.leaderClient = 0
      barrier.dedups = [0, 0]
      const reached = new Promise<void>((resolve) => { barrier.leaderReached = resolve })
      const leaderRun = critical(A, orgId, x.id, admin.id)
      await reached
      await critical(B, orgId, y.id, admin.id) // not blocked by the leader's lock
      barrier.pausedLeader?.()
      await leaderRun
      barrier.armed = false
      expect([await active(p1.id), await active(p2.id)]).toEqual([1, 1])
    })

    it('a legitimately RESTRICTED person without an active action gets exactly one', async () => {
      const orgId = await newOrg()
      const p = await restricted(orgId)
      await A.engine.runForOrg(orgId)
      await B.engine.runForOrg(orgId)
      expect(await active(p.id)).toBe(1)
    })
  })

  it('G — documented: closing does not take the creation lock, so the window between the live check and the creation remains', async () => {
    const orgId = await newOrg()
    const p = await restricted(orgId)
    const admin = await plainPerson(orgId, 'Admin')
    const open = await db.correctiveAction.create({ data: { personId: p.id, reason: 'aberta', status: 'OPEN' } })
    // The engine dedup sees the OPEN action (no creation); the action is closed right after it.
    barrier.armed = true
    barrier.leaderClient = 0
    barrier.dedups = [0, 0]
    const reached = new Promise<void>((resolve) => { barrier.leaderReached = resolve })
    const engineRun = A.engine.runForOrg(orgId)
    await reached
    await B.corrective.resolve(orgId, open.id, { userId: 'u-admin', personId: admin.id }) // not blocked: resolve does not use the lock
    barrier.pausedLeader?.()
    const result = await engineRun
    barrier.armed = false
    // The engine skipped creation (it saw the action before it was closed): the person now has no
    // active action although the risk may still justify one, until the next engine run.
    expect(result.correctivesCreated).toBe(0)
    expect(await active(p.id)).toBe(0)
  })
})
