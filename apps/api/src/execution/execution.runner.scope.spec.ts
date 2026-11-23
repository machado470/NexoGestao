import { ExecutionRunner } from './execution.runner'

/**
 * C8 PR3-3B-7 — explicit organization scope of ExecutionRunner.runOnce. Without scope (internal
 * scheduler) the cycle still covers every organization; with scope only that organization is
 * processed, once, without reading the global organization list and without the cooldown bypass.
 */
function build(candidatesByOrg: Record<string, Array<{ orgId: string; actionId: string }>>) {
  const prisma: any = { organization: { findMany: jest.fn(async () => Object.keys(candidatesByOrg).map((id) => ({ id }))) } }
  const config: any = { getMaxExecutionsPerCycle: () => 50, getCycleDelayMs: () => 0 }
  const runner = new ExecutionRunner(prisma, {} as any, config, {} as any, {} as any, {} as any, {} as any, {} as any)
  const load = jest.spyOn(runner as any, 'loadActionCandidates').mockImplementation(async (orgId: any) =>
    (candidatesByOrg[orgId] ?? []).map((c) => ({ ...c, priority: 'medium', entityId: `e-${c.actionId}`, decisionId: 'd', intent: 'i' })),
  )
  const process = jest.spyOn(runner as any, 'processCandidate').mockImplementation(async () => 'executed')
  return { runner, prisma, load, process }
}

const PLATFORM = {
  'org-a': [{ orgId: 'org-a', actionId: 'a1' }, { orgId: 'org-a', actionId: 'a2' }],
  'org-b': [{ orgId: 'org-b', actionId: 'b1' }],
  'org-c': [{ orgId: 'org-c', actionId: 'c1' }],
}

describe('ExecutionRunner.runOnce organization scope', () => {
  it('without scope (scheduler): every organization is listed and processed once, override passes through', async () => {
    const { runner, prisma, load, process } = build(PLATFORM)
    const result: any = await runner.runOnce({ overrideCooldown: true })
    expect(prisma.organization.findMany).toHaveBeenCalledTimes(1)
    expect(load.mock.calls.map((c) => c[0])).toEqual(['org-a', 'org-b', 'org-c'])
    expect(result).toMatchObject({ orgs: 3, totalCandidates: 4, executed: 4 })
    expect(process.mock.calls.every((c: any[]) => c[1].overrideCooldown === true)).toBe(true)
  })

  it('with scope: never reads the organization list and processes only that organization, once', async () => {
    const { runner, prisma, load, process } = build(PLATFORM)
    const result: any = await runner.runOnce({ scope: { orgId: 'org-a' } })
    expect(prisma.organization.findMany).not.toHaveBeenCalled()
    expect(load.mock.calls.map((c) => c[0])).toEqual(['org-a'])
    expect(process.mock.calls.map((c: any[]) => c[0].orgId)).toEqual(['org-a', 'org-a'])
    // Counters cover org-a only; `orgs` is the processed scope (1), never the platform total.
    expect(result).toMatchObject({ orgs: 1, totalCandidates: 2, executed: 2, failed: 0 })
  })

  it('with scope: a candidate of another organization is dropped before processing (defense in depth)', async () => {
    const { runner, process } = build({ 'org-a': [{ orgId: 'org-a', actionId: 'a1' }, { orgId: 'org-b', actionId: 'leak' }] })
    const result: any = await runner.runOnce({ scope: { orgId: 'org-a' } })
    expect(process.mock.calls.map((c: any[]) => c[0].actionId)).toEqual(['a1'])
    expect(result).toMatchObject({ orgs: 1, totalCandidates: 1, executed: 1 })
  })

  it('with scope: the cooldown bypass is ignored even when requested', async () => {
    const { runner, process } = build(PLATFORM)
    await runner.runOnce({ scope: { orgId: 'org-a' }, overrideCooldown: true })
    expect(process).toHaveBeenCalled()
    expect(process.mock.calls.every((c: any[]) => c[1].overrideCooldown === false)).toBe(true)
  })

  it.each([[''], ['   '], [undefined], [null]])('an invalid scope orgId (%p) is refused before any work', async (orgId) => {
    const { runner, prisma, load } = build(PLATFORM)
    await expect(runner.runOnce({ scope: { orgId: orgId as any } })).rejects.toThrow('Escopo de organização inválido')
    expect(prisma.organization.findMany).not.toHaveBeenCalled()
    expect(load).not.toHaveBeenCalled()
  })
})
