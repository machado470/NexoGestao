import { EnforcementEngineService } from './enforcement-engine.service'
import { EnforcementPolicyService } from './enforcement-policy.service'

/**
 * C8 PR3-3B-4 — enforcement engine consistency.
 * (A) A corrective action is never created from a stale persisted score: the live risk (same
 *     calculation and thresholds as the OperationalStateGuard) is re-checked right before acting.
 * (B) OPERATIONAL_WARNING_RAISED / OPERATIONAL_STATE_ENFORCED are emitted only when something really
 *     happened (CAS-confirmed transition, or a newly created corrective action), not on every run.
 */

const UPDATED_AT = new Date('2026-11-01T00:00:00.000Z')

function build(params: { state: string; persistedScore: number; liveScore: number; activeCorrective?: boolean; claimCount?: number; orgId?: string }) {
  const orgId = params.orgId ?? 'org-a'
  const prisma: any = {
    person: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'person-a', orgId, operationalState: params.state, operationalRiskScore: params.persistedScore, operationalStateUpdatedAt: UPDATED_AT },
      ]),
      updateMany: jest.fn().mockResolvedValue({ count: params.claimCount ?? 1 }),
      findFirst: jest.fn().mockResolvedValue({ id: 'person-a' }),
    },
    correctiveAction: {
      findFirst: jest.fn().mockResolvedValue(params.activeCorrective ? { id: 'ca-existing' } : null),
      create: jest.fn().mockResolvedValue({ id: 'ca-new' }),
    },
    $queryRaw: jest.fn().mockResolvedValue([{ active: false }]),
  }
  prisma.$transaction = jest.fn(async (callback: any) => callback({ person: prisma.person, correctiveAction: prisma.correctiveAction, $queryRaw: prisma.$queryRaw }))
  const timeline = {
    log: jest.fn().mockResolvedValue(undefined),
    logInTransaction: jest.fn().mockResolvedValue({ id: 'state-event' }),
    dispatchPersistedEventWebhook: jest.fn().mockResolvedValue(undefined),
  }
  const temporalRisk = { calculate: jest.fn(async () => params.liveScore) }
  const service = new EnforcementEngineService(prisma, new EnforcementPolicyService(), timeline as any, { getLastState: jest.fn().mockResolvedValue(null) } as any, temporalRisk as any)
  const enforcementEvents = () => timeline.log.mock.calls.map(([input]: any) => input.action).filter((a: string) => a === 'OPERATIONAL_STATE_ENFORCED' || a === 'OPERATIONAL_WARNING_RAISED')
  return { service, prisma, timeline, temporalRisk, enforcementEvents }
}

describe('C8 PR3-3B-4 (A): no corrective action from a stale persisted score', () => {
  it('persisted RESTRICTED (75) with live risk 0: no action, no transition, no event', async () => {
    const t = build({ state: 'RESTRICTED', persistedScore: 75, liveScore: 0 })
    const result = await t.service.runForOrg('org-a')
    expect(t.temporalRisk.calculate).toHaveBeenCalledWith('person-a', 'org-a')
    expect(t.prisma.correctiveAction.create).not.toHaveBeenCalled()
    expect(t.prisma.$transaction).not.toHaveBeenCalled()
    expect(t.enforcementEvents()).toEqual([])
    expect(result).toMatchObject({ evaluated: 1, correctivesCreated: 0, restrictedCount: 0, suspendedCount: 0 })
  })

  it('persisted RESTRICTED with live WARNING (60): no action and no event (the engine does not act on WARNING here)', async () => {
    const t = build({ state: 'RESTRICTED', persistedScore: 75, liveScore: 60 })
    await t.service.runForOrg('org-a')
    expect(t.prisma.correctiveAction.create).not.toHaveBeenCalled()
    expect(t.enforcementEvents()).toEqual([])
  })

  it('live risk that confirms RESTRICTED: one action is created and the event is emitted once', async () => {
    const t = build({ state: 'RESTRICTED', persistedScore: 75, liveScore: 75 })
    const result = await t.service.runForOrg('org-a')
    expect(t.prisma.correctiveAction.create).toHaveBeenCalledTimes(1)
    expect(t.enforcementEvents()).toEqual(['OPERATIONAL_STATE_ENFORCED'])
    expect(t.timeline.log).toHaveBeenCalledWith(expect.objectContaining({ orgId: 'org-a', personId: 'person-a', metadata: expect.objectContaining({ riskScore: 75, correctiveCreated: true }) }))
    expect(result).toMatchObject({ correctivesCreated: 1, restrictedCount: 1 })
  })

  it('the live decision is used when it differs (persisted RESTRICTED, live SUSPENDED) and the live score is persisted', async () => {
    const t = build({ state: 'RESTRICTED', persistedScore: 75, liveScore: 95 })
    await t.service.runForOrg('org-a')
    expect(t.prisma.correctiveAction.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ reason: expect.stringContaining('SUSPENDED') }) }))
    // CAS on the persisted snapshot (75), writing the live score (95).
    expect(t.prisma.person.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'person-a', orgId: 'org-a', operationalState: 'RESTRICTED', operationalRiskScore: 75 }),
      data: expect.objectContaining({ operationalState: 'SUSPENDED', operationalRiskScore: 95 }),
    }))
  })

  it('NORMAL or WARNING persisted scores never trigger the live check', async () => {
    for (const persistedScore of [10, 60]) {
      const t = build({ state: 'NORMAL', persistedScore, liveScore: 99 })
      await t.service.runForOrg('org-a')
      expect(t.temporalRisk.calculate).not.toHaveBeenCalled()
      expect(t.prisma.correctiveAction.create).not.toHaveBeenCalled()
    }
  })

  it('the live check is scoped to the person organization', async () => {
    const t = build({ state: 'RESTRICTED', persistedScore: 80, liveScore: 80, orgId: 'org-b' })
    await t.service.runForOrg('org-b')
    expect(t.temporalRisk.calculate).toHaveBeenCalledWith('person-a', 'org-b')
  })
})

describe('C8 PR3-3B-4 (B): enforcement events only on real changes', () => {
  it('WARNING already persisted: no OPERATIONAL_WARNING_RAISED on a periodic run', async () => {
    const t = build({ state: 'WARNING', persistedScore: 60, liveScore: 60 })
    for (let i = 0; i < 3; i++) await t.service.runForOrg('org-a')
    expect(t.enforcementEvents()).toEqual([])
  })

  it('NORMAL → WARNING confirmed by the CAS: one OPERATIONAL_WARNING_RAISED', async () => {
    const t = build({ state: 'NORMAL', persistedScore: 60, liveScore: 60 })
    await t.service.runForOrg('org-a')
    expect(t.enforcementEvents()).toEqual(['OPERATIONAL_WARNING_RAISED'])
  })

  it('a CAS that is not confirmed (newer state persisted meanwhile) emits no transition event', async () => {
    const warning = build({ state: 'NORMAL', persistedScore: 60, liveScore: 60, claimCount: 0 })
    await warning.service.runForOrg('org-a')
    expect(warning.enforcementEvents()).toEqual([])
    // Critical path with an existing action: no new action, CAS not confirmed → no event.
    const enforced = build({ state: 'NORMAL', persistedScore: 80, liveScore: 80, activeCorrective: true, claimCount: 0 })
    await enforced.service.runForOrg('org-a')
    expect(enforced.prisma.correctiveAction.create).not.toHaveBeenCalled()
    expect(enforced.enforcementEvents()).toEqual([])
  })

  it('RESTRICTED already persisted with an active corrective action: no event and no new action on repeated runs', async () => {
    const t = build({ state: 'RESTRICTED', persistedScore: 80, liveScore: 80, activeCorrective: true })
    for (let i = 0; i < 3; i++) await t.service.runForOrg('org-a')
    expect(t.prisma.correctiveAction.create).not.toHaveBeenCalled()
    expect(t.prisma.person.updateMany).not.toHaveBeenCalled() // no state transition (CAS never ran)
    expect(t.enforcementEvents()).toEqual([])
  })

  it('a transition confirmed by the CAS with an existing action still emits OPERATIONAL_STATE_ENFORCED once', async () => {
    const t = build({ state: 'NORMAL', persistedScore: 80, liveScore: 80, activeCorrective: true })
    await t.service.runForOrg('org-a')
    expect(t.prisma.correctiveAction.create).not.toHaveBeenCalled()
    expect(t.enforcementEvents()).toEqual(['OPERATIONAL_STATE_ENFORCED'])
    expect(t.timeline.log).toHaveBeenCalledWith(expect.objectContaining({ metadata: expect.objectContaining({ correctiveCreated: false }) }))
  })
})
