import { Prisma } from '@prisma/client'

/**
 * C8 PR3-3B-5 — atomic creation of corrective actions, shared by the enforcement engine and the
 * assessments module.
 *
 * Both modules used `findFirst` (dedup) then `create` without any lock: concurrent callers for the
 * same person all saw "no existing action" and all created one (measured with PostgreSQL: 8/10 for
 * two engines, 8/10 for two critical assessments, 4/10 for engine + assessment).
 *
 * Protocol (one short transaction):
 * 1. `pg_advisory_xact_lock` on a key derived from (orgId, personId): every creator for the same
 *    person of the same organization is serialized; other people are never blocked. The lock is
 *    transaction-scoped, so it is released by commit or rollback and does not depend on which
 *    pooled connection runs a later query (unlike the session lock of the enforcement job).
 * 2. The person is re-checked inside the organization (never creates for a foreign person).
 * 3. The caller's own dedup rule is evaluated after the lock, inside the same transaction.
 * 4. The action is created in that transaction. On any failure nothing is created.
 *
 * Each module keeps its own dedup rule (`duplicateWhere`); this helper does not unify them.
 */

/** Client able to open an interactive transaction (PrismaService or PrismaClient). */
export type TransactionCapableClient = {
  $transaction<R>(fn: (tx: Prisma.TransactionClient) => Promise<R>, options?: { timeout?: number; maxWait?: number }): Promise<R>
}

export type CreatedCorrectiveAction = { id: string; personId: string; reason: string; status: string; createdAt: Date }

/** `outcome` is the discriminant (string literal, so it narrows without strictNullChecks). */
export type CorrectiveActionCreationResult =
  | { outcome: 'CREATED'; created: true; action: CreatedCorrectiveAction }
  | { outcome: 'DUPLICATE'; created: false; existingId: string }
  | { outcome: 'PERSON_NOT_IN_ORGANIZATION'; created: false }

/** Lock key shared by every module: the same person of the same organization maps to one key. */
export function correctiveActionLockKey(orgId: string, personId: string): string {
  return `corrective-actions:v1:${orgId}:${personId}`
}

export async function createCorrectiveActionAtomically(
  prisma: TransactionCapableClient,
  params: {
    orgId: string
    personId: string
    reason: string
    /** The caller's dedup rule; combined with the person and organization filters. */
    duplicateWhere: Prisma.CorrectiveActionWhereInput
  },
): Promise<CorrectiveActionCreationResult> {
  if (!params.orgId || !params.personId) {
    throw new Error('createCorrectiveActionAtomically(): orgId e personId são obrigatórios')
  }

  return prisma.$transaction(async (tx): Promise<CorrectiveActionCreationResult> => {
    // Parameterized: the key is bound as a value, never interpolated into the SQL text.
    await tx.$queryRaw`SELECT 1::int AS "locked" FROM pg_advisory_xact_lock(hashtextextended(${correctiveActionLockKey(params.orgId, params.personId)}, 0))`

    const person = await tx.person.findFirst({
      where: { id: params.personId, orgId: params.orgId },
      select: { id: true },
    })
    if (!person) return { outcome: 'PERSON_NOT_IN_ORGANIZATION', created: false }

    const existing = await tx.correctiveAction.findFirst({
      where: { ...params.duplicateWhere, personId: params.personId, person: { orgId: params.orgId } },
      select: { id: true },
    })
    if (existing) return { outcome: 'DUPLICATE', created: false, existingId: existing.id }

    const action = await tx.correctiveAction.create({
      data: { personId: params.personId, reason: params.reason, status: 'OPEN' },
      select: { id: true, personId: true, reason: true, status: true, createdAt: true },
    })
    return { outcome: 'CREATED', created: true, action }
  })
}
