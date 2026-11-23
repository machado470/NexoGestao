import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'

import { AuditService } from '../../src/audit/audit.service'
import { CorrectiveActionsService } from '../../src/corrective-actions/corrective-actions.service'
import { EnforcementEngineService } from '../../src/governance/enforcement-engine.service'
import { EnforcementPolicyService } from '../../src/governance/enforcement-policy.service'
import { OperationalStateJob } from '../../src/people/operational-state.job'
import { OperationalStateRepository } from '../../src/people/operational-state.repository'
import { OperationalStateService } from '../../src/people/operational-state.service'
import { RiskService } from '../../src/risk/risk.service'
import { TemporalRiskService } from '../../src/risk/temporal-risk.service'
import { TimelineService } from '../../src/timeline/timeline.service'
import { describeRealIntegration } from './infra-guards'

/**
 * C8 PR3-3B-4 — enforcement engine consistency with PostgreSQL and the real engine, policy,
 * temporal risk, timeline, operational-state reconciliation job and corrective-actions service.
 *
 * (A) No corrective action from a stale persisted score. (B) No periodic enforcement events, so the
 * engine no longer feeds the risk score back. Historical events inside the 90-day window still count.
 */
describeRealIntegration('Enforcement engine consistency with PostgreSQL', () => {
  jest.setTimeout(60000)
  const prisma = new PrismaClient()
  const requestContext: any = { requestId: 'req-gov', userId: null, personId: null, orgId: null, correlationId: 'req-gov', getAll: () => ({}) }
  const timeline = new TimelineService(prisma as any, requestContext, { dispatchTimelineEvent: async () => undefined } as any)
  const temporal = new TemporalRiskService(prisma as any)
  const repository = new OperationalStateRepository(prisma as any)
  const risk = new RiskService(prisma as any, temporal, timeline)
  const operationalState = new OperationalStateService(temporal, repository, timeline, prisma as any)
  const reconciliation = new OperationalStateJob(prisma as any, timeline, risk, repository)
  const corrective = new CorrectiveActionsService(prisma as any, timeline, operationalState, risk, new AuditService(prisma as any), requestContext)
  const engineWith = (riskSource: any = temporal) =>
    new EnforcementEngineService(prisma as any, new EnforcementPolicyService(), timeline, repository, riskSource)
  const engine = engineWith()
  const orgIds: string[] = []
  let orgId: string

  async function newOrg() {
    const id = randomUUID()
    orgIds.push(id)
    await prisma.organization.create({ data: { id, name: 'Governance consistency', slug: `gov-consistency-${id}` } })
    return id
  }
  const person = (data: { score: number; state: 'NORMAL' | 'WARNING' | 'RESTRICTED' | 'SUSPENDED'; org?: string; name?: string }) =>
    prisma.person.create({
      data: { orgId: data.org ?? orgId, name: data.name ?? 'Pessoa', role: 'TECH', active: true, operationalRiskScore: data.score, riskScore: data.score, operationalState: data.state, operationalStateUpdatedAt: new Date() },
    })
  const openActions = (personId: string) => prisma.correctiveAction.count({ where: { personId, status: { in: ['OPEN', 'AWAITING_REASSESSMENT'] } } })
  const enforcementEvents = (personId: string) =>
    prisma.timelineEvent.count({ where: { personId, action: { in: ['OPERATIONAL_STATE_ENFORCED', 'OPERATIONAL_WARNING_RAISED'] } } })
  const live = (personId: string, org = orgId) => temporal.calculateDetailed(personId, org)
  const persisted = (id: string) => prisma.person.findUniqueOrThrow({ where: { id }, select: { operationalRiskScore: true, operationalState: true } })
  /** Assignment with progress 0: LOW_AVG_PROGRESS + VERY_LOW_AVG_PROGRESS = 60 points of real risk. */
  async function lowProgress(personId: string) {
    const track = await prisma.track.create({ data: { orgId, slug: `t-${randomUUID()}`, title: 'Trilha', status: 'ACTIVE', version: 1 } })
    await prisma.assignment.create({ data: { personId, trackId: track.id, progress: 0 } })
  }
  /** Canonical critical timeline events (+5 each, max 20). APPOINTMENT_CANCELLED counts only here. */
  const criticalEvents = (personId: string, n: number, createdAt?: Date, action = 'APPOINTMENT_CANCELLED') =>
    prisma.timelineEvent.createMany({ data: Array.from({ length: n }, () => ({ orgId, personId, action, ...(createdAt ? { createdAt } : {}) })) })

  beforeEach(async () => {
    orgId = await newOrg()
  })

  afterAll(async () => {
    const people = { orgId: { in: orgIds } }
    await prisma.auditEvent.deleteMany({ where: { orgId: { in: orgIds } } })
    await prisma.timelineEvent.deleteMany({ where: { orgId: { in: orgIds } } })
    await prisma.riskSnapshot.deleteMany({ where: { person: people } })
    await prisma.correctiveAction.deleteMany({ where: { person: people } })
    await prisma.assignment.deleteMany({ where: { person: people } })
    await prisma.track.deleteMany({ where: { orgId: { in: orgIds } } })
    await prisma.person.deleteMany({ where: people })
    await prisma.organization.deleteMany({ where: { id: { in: orgIds } } })
    await prisma.$disconnect()
  })

  describe('A — stale persisted score (75) with real risk 0', () => {
    it('no corrective action, no enforcement event and no artificial risk increase over repeated runs', async () => {
      const p = await person({ score: 75, state: 'RESTRICTED' })
      await prisma.correctiveAction.create({ data: { personId: p.id, reason: 'encerrada', status: 'DONE', resolvedAt: new Date() } })
      expect((await live(p.id)).score).toBe(0)
      for (let i = 0; i < 3; i++) {
        const result = await engine.runForOrg(orgId)
        expect(result.correctivesCreated).toBe(0)
      }
      expect(await openActions(p.id)).toBe(0)
      expect(await enforcementEvents(p.id)).toBe(0)
      expect((await live(p.id)).score).toBe(0)
      // The engine left the stale row alone; the reconciliation job repairs it.
      await reconciliation.run()
      expect(await persisted(p.id)).toEqual({ operationalRiskScore: expect.any(Number), operationalState: 'NORMAL' })
    })
  })

  describe('B — legitimately RESTRICTED', () => {
    it('without an active action: one is created, later runs do not duplicate it nor emit events without a real change', async () => {
      const p = await person({ score: 70, state: 'RESTRICTED' })
      await lowProgress(p.id)
      await criticalEvents(p.id, 2) // 60 + 10 = 70 (RESTRICTED)
      expect((await live(p.id)).score).toBe(70)
      const first = await engine.runForOrg(orgId)
      expect(first.correctivesCreated).toBe(1)
      expect(await openActions(p.id)).toBe(1)
      const eventsAfterFirst = await enforcementEvents(p.id)
      expect(eventsAfterFirst).toBe(1) // OPERATIONAL_STATE_ENFORCED for the creation
      // Later runs: the new action is real risk (+20, and its event +5), which may escalate the state once.
      await engine.runForOrg(orgId)
      const eventsAfterSecond = await enforcementEvents(p.id)
      for (let i = 0; i < 3; i++) {
        const r = await engine.runForOrg(orgId)
        expect(r.correctivesCreated).toBe(0)
      }
      expect(await openActions(p.id)).toBe(1)
      expect(await enforcementEvents(p.id)).toBe(eventsAfterSecond) // stable: no event without a change
      expect(eventsAfterSecond - eventsAfterFirst).toBeLessThanOrEqual(1)
    })

    it('with an active action: no new action; events only for confirmed transitions, then stable', async () => {
      const p = await person({ score: 80, state: 'NORMAL' })
      await lowProgress(p.id)
      await prisma.correctiveAction.create({ data: { personId: p.id, reason: 'existente', status: 'OPEN' } }) // 60 + 20 = 80
      await engine.runForOrg(orgId)
      expect(await openActions(p.id)).toBe(1)
      expect(await persisted(p.id)).toMatchObject({ operationalState: 'RESTRICTED' })
      expect(await enforcementEvents(p.id)).toBe(1)
      // Residual (documented): the confirmed transition writes OPERATIONAL_STATE_CHANGED and
      // OPERATIONAL_STATE_ENFORCED (+5 each), which can cross the next threshold once (80 → 90).
      for (let i = 0; i < 2; i++) await engine.runForOrg(orgId)
      const settled = await enforcementEvents(p.id)
      expect(settled).toBeLessThanOrEqual(2)
      for (let i = 0; i < 4; i++) await engine.runForOrg(orgId)
      expect(await enforcementEvents(p.id)).toBe(settled)
      expect(await openActions(p.id)).toBe(1)
      expect(['RESTRICTED', 'SUSPENDED']).toContain((await live(p.id)).state) // the legitimate restriction is preserved
    })
  })

  describe('C — real base risk 40 (three OPEN actions), persisted WARNING', () => {
    it('engine + reconciliation runs do not raise the score through periodic events (the audit cycle reached 60 WARNING)', async () => {
      const p = await person({ score: 55, state: 'WARNING' })
      for (let i = 0; i < 3; i++) await prisma.correctiveAction.create({ data: { personId: p.id, reason: `base ${i}`, status: 'OPEN' } })
      expect((await live(p.id)).score).toBe(40)
      const scores: number[] = []
      for (let i = 0; i < 6; i++) {
        await engine.runForOrg(orgId)
        await reconciliation.run()
        scores.push((await persisted(p.id)).operationalRiskScore)
      }
      expect(await prisma.timelineEvent.count({ where: { personId: p.id, action: 'OPERATIONAL_WARNING_RAISED' } })).toBe(0)
      // At most the single real transition WARNING → NORMAL is recorded (+5); the score stays below WARNING.
      expect(Math.max(...scores)).toBeLessThan(50)
      expect(scores[scores.length - 1]).toBe(scores[scores.length - 2])
      expect((await persisted(p.id)).operationalState).toBe('NORMAL')
    })

    it('historical enforcement events inside the 90-day window still count; outside it they do not', async () => {
      const p = await person({ score: 40, state: 'NORMAL' })
      for (let i = 0; i < 3; i++) await prisma.correctiveAction.create({ data: { personId: p.id, reason: `base ${i}`, status: 'OPEN' } })
      await criticalEvents(p.id, 4, new Date(Date.now() - 30 * 86400000), 'OPERATIONAL_WARNING_RAISED')
      expect((await live(p.id)).score).toBe(60) // 40 + 20 from old events (not rewritten by this change)
      const other = await person({ score: 40, state: 'NORMAL' })
      for (let i = 0; i < 3; i++) await prisma.correctiveAction.create({ data: { personId: other.id, reason: `base ${i}`, status: 'OPEN' } })
      await criticalEvents(other.id, 4, new Date(Date.now() - 91 * 86400000), 'OPERATIONAL_WARNING_RAISED')
      expect((await live(other.id)).score).toBe(40)
      // With history inside the window the engine can still record one real transition, but not repeat it.
      for (let i = 0; i < 3; i++) { await reconciliation.run(); await engine.runForOrg(orgId) }
      expect(await prisma.timelineEvent.count({ where: { personId: p.id, action: 'OPERATIONAL_WARNING_RAISED' } })).toBeLessThanOrEqual(5)
      expect((await live(p.id)).score).toBeLessThanOrEqual(60)
    })
  })

  describe('D — concurrency', () => {
    it('engine and recalculation at the same time: no action from the stale score, consistent final state', async () => {
      const p = await person({ score: 75, state: 'RESTRICTED' })
      await Promise.all([engine.runForOrg(orgId), risk.recalculatePersonRisk(p.id, 'concurrent recalculation', orgId)])
      expect(await openActions(p.id)).toBe(0)
      expect(await enforcementEvents(p.id)).toBe(0)
      expect(await persisted(p.id)).toMatchObject({ operationalState: 'NORMAL' })
    })

    it('engine and closing: closing before the live check prevents the action', async () => {
      const admin = await person({ score: 0, state: 'NORMAL', name: 'Admin' })
      const p = await person({ score: 80, state: 'RESTRICTED' })
      await lowProgress(p.id)
      const action = await prisma.correctiveAction.create({ data: { personId: p.id, reason: 'aberta', status: 'OPEN' } })
      // Closing happens after the engine read the persisted list but before its live check.
      const closingFirst = { calculate: async (id: string, org?: string) => { await corrective.resolve(orgId, action.id, { userId: 'u-admin', personId: admin.id }); return temporal.calculate(id, org) } }
      await engineWith(closingFirst).runForOrg(orgId)
      // Live 60 (WARNING) after closing: no new action.
      expect(await openActions(p.id)).toBe(0)
    })

    it('documented window: closing between the live check and the creation still lets the engine create one action', async () => {
      const admin = await person({ score: 0, state: 'NORMAL', name: 'Admin' })
      const p = await person({ score: 80, state: 'RESTRICTED' })
      await lowProgress(p.id)
      const action = await prisma.correctiveAction.create({ data: { personId: p.id, reason: 'aberta', status: 'OPEN' } })
      const closingAfter = { calculate: async (id: string, org?: string) => { const score = await temporal.calculate(id, org); await corrective.resolve(orgId, action.id, { userId: 'u-admin', personId: admin.id }); return score } }
      await engineWith(closingAfter).runForOrg(orgId)
      // The live check saw 80 (with the action still OPEN); the action was closed right after; the
      // dedup no longer finds an active one, so one new action is created. Not eliminated by this PR.
      expect(await openActions(p.id)).toBe(1)
    })

    it('two sequential runs never duplicate the action; the reason is the existing deduplication', async () => {
      const p = await person({ score: 70, state: 'RESTRICTED' })
      await lowProgress(p.id)
      await criticalEvents(p.id, 2)
      await engine.runForOrg(orgId)
      await engine.runForOrg(orgId)
      expect(await openActions(p.id)).toBe(1)
    })

    it('a CAS that is not confirmed (state updated meanwhile) emits no transition event', async () => {
      const p = await person({ score: 60, state: 'NORMAL' })
      // Between the engine read and its CAS, another writer updates the person (e.g. a recalculation).
      const racing = new Proxy(prisma, {
        get(target, prop) {
          if (prop !== '$queryRaw') return (target as any)[prop]
          return async (...args: any[]) => {
            await target.person.update({ where: { id: p.id }, data: { operationalRiskScore: 61, operationalStateUpdatedAt: new Date() } })
            return (target as any).$queryRaw(...args)
          }
        },
      })
      await new EnforcementEngineService(racing as any, new EnforcementPolicyService(), timeline, repository, temporal).runForOrg(orgId)
      expect(await enforcementEvents(p.id)).toBe(0)
      expect(await persisted(p.id)).toEqual({ operationalRiskScore: 61, operationalState: 'NORMAL' })
    })
  })

  describe('E — security', () => {
    it('organization isolation: running for org A never touches a stale or restricted person of org B', async () => {
      const orgB = await newOrg()
      const b = await person({ score: 95, state: 'SUSPENDED', org: orgB })
      await engine.runForOrg(orgId)
      expect(await openActions(b.id)).toBe(0)
      expect(await enforcementEvents(b.id)).toBe(0)
      expect(await persisted(b.id)).toEqual({ operationalRiskScore: 95, operationalState: 'SUSPENDED' })
    })

    it('the live check uses the person organization: a foreign person id is never evaluated for org A', async () => {
      const orgB = await newOrg()
      const b = await person({ score: 95, state: 'SUSPENDED', org: orgB })
      const calls: Array<[string, string | undefined]> = []
      const spy = { calculate: async (id: string, org?: string) => { calls.push([id, org]); return temporal.calculate(id, org) } }
      await person({ score: 80, state: 'RESTRICTED' })
      await engineWith(spy).runForOrg(orgId)
      expect(calls.every(([id, org]) => org === orgId && id !== b.id)).toBe(true)
    })
  })
})
