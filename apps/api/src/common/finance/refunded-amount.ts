import { Prisma } from '@prisma/client'
import type { PrismaService } from '../../prisma/prisma.service'

type Period = { gte?: Date; gt?: Date; lt?: Date; lte?: Date }
function within(column: Prisma.Sql, period?: Period) {
  const clauses: Prisma.Sql[] = []
  if (period?.gte) clauses.push(Prisma.sql`${column} >= ${period.gte}`)
  if (period?.gt) clauses.push(Prisma.sql`${column} > ${period.gt}`)
  if (period?.lt) clauses.push(Prisma.sql`${column} < ${period.lt}`)
  if (period?.lte) clauses.push(Prisma.sql`${column} <= ${period.lte}`)
  return clauses.length ? Prisma.join(clauses, ' AND ') : Prisma.sql`TRUE`
}

/** One DB snapshot: refund debits and reversal credits follow their own dates. */
export async function refundedAmount(db: Pick<PrismaService, '$queryRaw'>, where: {
  orgId: string; paidAt?: Period; chargeId?: string; charge?: { orgId?: string; customerId?: string }
}) {
  const rows = await db.$queryRaw<Array<{ amountCents: bigint }>>(Prisma.sql`
    SELECT COALESCE(SUM(
      CASE WHEN ${within(Prisma.sql`r."refundedAt"`, where.paidAt)} THEN r."amountCents" ELSE 0 END
      - CASE WHEN r."reversedAt" IS NOT NULL AND ${within(Prisma.sql`r."reversedAt"`, where.paidAt)} THEN r."amountCents" ELSE 0 END
    ), 0)::bigint AS "amountCents"
    FROM "PaymentRefund" r
    JOIN "Payment" p ON p.id = r."paymentId" AND p."orgId" = r."orgId"
    JOIN "Charge" c ON c.id = p."chargeId" AND c."orgId" = r."orgId"
    WHERE r."orgId" = ${where.orgId}
      AND c."orgId" = ${where.charge?.orgId ?? where.orgId}
      ${where.chargeId ? Prisma.sql`AND c.id = ${where.chargeId}` : Prisma.empty}
      ${where.charge?.customerId ? Prisma.sql`AND c."customerId" = ${where.charge.customerId}` : Prisma.empty}
  `)
  const value = Number(rows[0]?.amountCents ?? 0)
  if (!Number.isSafeInteger(value)) throw new Error('Valor financeiro fora do intervalo numérico seguro')
  return value
}
