import { correctiveActionLockKey, createCorrectiveActionAtomically } from './corrective-action-creation'

/** C8 PR3-3B-5 — unit contract of the atomic corrective-action creation helper. */
function client(params: { personInOrg?: boolean; existing?: { id: string } | null; failCreate?: boolean } = {}) {
  const calls: string[] = []
  const tx: any = {
    $queryRaw: jest.fn(async (...args: any[]) => {
      calls.push('lock')
      return [{ locked: 1 }]
    }),
    person: { findFirst: jest.fn(async () => { calls.push('person'); return params.personInOrg === false ? null : { id: 'person-a' } }) },
    correctiveAction: {
      findFirst: jest.fn(async () => { calls.push('dedup'); return params.existing ?? null }),
      create: jest.fn(async ({ data }: any) => {
        calls.push('create')
        if (params.failCreate) throw new Error('simulated create failure')
        return { id: 'ca-new', createdAt: new Date('2026-11-23T00:00:00.000Z'), ...data }
      }),
    },
  }
  const prisma = { $transaction: jest.fn(async (fn: any) => fn(tx)) }
  return { prisma, tx, calls }
}

const base = { orgId: 'org-a', personId: 'person-a', reason: 'motivo', duplicateWhere: { status: { in: ['OPEN', 'AWAITING_REASSESSMENT'] as any } } }

describe('createCorrectiveActionAtomically', () => {
  it('lock → person check → dedup → create, all in one transaction', async () => {
    const { prisma, tx, calls } = client()
    const result = await createCorrectiveActionAtomically(prisma, base)
    expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    expect(calls).toEqual(['lock', 'person', 'dedup', 'create'])
    expect(result).toEqual({ outcome: 'CREATED', created: true, action: expect.objectContaining({ id: 'ca-new', personId: 'person-a', reason: 'motivo', status: 'OPEN' }) })
    expect(tx.person.findFirst).toHaveBeenCalledWith({ where: { id: 'person-a', orgId: 'org-a' }, select: { id: true } })
    expect(tx.correctiveAction.findFirst).toHaveBeenCalledWith({
      where: { status: { in: ['OPEN', 'AWAITING_REASSESSMENT'] }, personId: 'person-a', person: { orgId: 'org-a' } },
      select: { id: true },
    })
  })

  it('the lock key is bound as a parameter (tagged template), never interpolated into the SQL text', async () => {
    const { prisma, tx } = client()
    await createCorrectiveActionAtomically(prisma, base)
    const [strings, ...values] = tx.$queryRaw.mock.calls[0]
    expect(strings.join('?')).toBe('SELECT 1::int AS "locked" FROM pg_advisory_xact_lock(hashtextextended(?, 0))')
    expect(values).toEqual(['corrective-actions:v1:org-a:person-a'])
  })

  it('the same person and organization always map to the same key; others do not collide', () => {
    expect(correctiveActionLockKey('org-a', 'person-a')).toBe(correctiveActionLockKey('org-a', 'person-a'))
    expect(correctiveActionLockKey('org-a', 'person-a')).not.toBe(correctiveActionLockKey('org-a', 'person-b'))
    expect(correctiveActionLockKey('org-a', 'person-a')).not.toBe(correctiveActionLockKey('org-b', 'person-a'))
  })

  it('an existing action matching the caller rule: DUPLICATE, nothing created', async () => {
    const { prisma, tx } = client({ existing: { id: 'ca-existing' } })
    expect(await createCorrectiveActionAtomically(prisma, base)).toEqual({ outcome: 'DUPLICATE', created: false, existingId: 'ca-existing' })
    expect(tx.correctiveAction.create).not.toHaveBeenCalled()
  })

  it('a person outside the organization: nothing created, dedup not even evaluated', async () => {
    const { prisma, tx } = client({ personInOrg: false })
    expect(await createCorrectiveActionAtomically(prisma, base)).toEqual({ outcome: 'PERSON_NOT_IN_ORGANIZATION', created: false })
    expect(tx.correctiveAction.findFirst).not.toHaveBeenCalled()
    expect(tx.correctiveAction.create).not.toHaveBeenCalled()
  })

  it('a failure inside the transaction propagates (the transaction rolls back)', async () => {
    const { prisma } = client({ failCreate: true })
    await expect(createCorrectiveActionAtomically(prisma, base)).rejects.toThrow('simulated create failure')
  })

  it('refuses to run without organization or person', async () => {
    const { prisma } = client()
    await expect(createCorrectiveActionAtomically(prisma, { ...base, orgId: '' })).rejects.toThrow('orgId e personId são obrigatórios')
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })
})
