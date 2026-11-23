jest.mock('./operational-state.transition', () => ({
  persistOperationalStateTransition: jest.fn(async () => ({ claimed: true })),
}))

import { OperationalStateJob } from './operational-state.job'
import { persistOperationalStateTransition } from './operational-state.transition'

/** C8 PR3-3B-7 — explicit organization scope of OperationalStateJob.run. */
const PEOPLE = [
  { id: 'pa1', orgId: 'org-a', operationalState: 'NORMAL', operationalRiskScore: 0, operationalStateUpdatedAt: null },
  { id: 'pa2', orgId: 'org-a', operationalState: 'NORMAL', operationalRiskScore: 0, operationalStateUpdatedAt: null },
  { id: 'pb1', orgId: 'org-b', operationalState: 'NORMAL', operationalRiskScore: 0, operationalStateUpdatedAt: null },
]

function build(rows = PEOPLE) {
  const prisma: any = { person: { findMany: jest.fn(async () => rows) } }
  const risk: any = { calculatePersonRisk: jest.fn(async () => 10) }
  const job = new OperationalStateJob(prisma, {} as any, risk, {} as any)
  return { job, prisma, risk }
}

describe('OperationalStateJob.run organization scope', () => {
  beforeEach(() => jest.clearAllMocks())

  it('without scope (scheduler): every active person of every organization, query unchanged', async () => {
    const { job, prisma, risk } = build()
    expect(await job.run()).toEqual({ evaluated: 3, changed: 3 })
    expect(prisma.person.findMany.mock.calls[0][0].where).toEqual({ active: true })
    expect(risk.calculatePersonRisk.mock.calls).toEqual([['pa1', undefined], ['pa2', undefined], ['pb1', undefined]])
  })

  it('with scope: the query is filtered explicitly by orgId and the risk is computed within it', async () => {
    const { job, prisma, risk } = build(PEOPLE.filter((p) => p.orgId === 'org-a'))
    expect(await job.run({ orgId: 'org-a' })).toEqual({ evaluated: 2, changed: 2 })
    expect(prisma.person.findMany.mock.calls[0][0].where).toEqual({ active: true, orgId: 'org-a' })
    expect(risk.calculatePersonRisk.mock.calls).toEqual([['pa1', 'org-a'], ['pa2', 'org-a']])
  })

  it('with scope: a row of another organization is skipped (defense in depth)', async () => {
    const { job, risk } = build()
    expect(await job.run({ orgId: 'org-a' })).toEqual({ evaluated: 2, changed: 2 })
    expect(risk.calculatePersonRisk).not.toHaveBeenCalledWith('pb1', expect.anything())
    expect((persistOperationalStateTransition as jest.Mock).mock.calls.map((c) => c[0].snapshot.id)).toEqual(['pa1', 'pa2'])
  })

  it.each([[''], [undefined], [null]])('an invalid scope orgId (%p) is refused before any query', async (orgId) => {
    const { job, prisma } = build()
    await expect(job.run({ orgId: orgId as any })).rejects.toThrow('Escopo de organização inválido')
    expect(prisma.person.findMany).not.toHaveBeenCalled()
  })
})
