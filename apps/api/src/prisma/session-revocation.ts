import { Prisma } from '@prisma/client'

/** Revoke previous sessions in the same SQL mutation as security-sensitive account changes. */
export function applySessionRevocation(params: Prisma.MiddlewareParams): void {
  if (params.model !== 'User' || !['update', 'updateMany', 'upsert'].includes(params.action)) return
  const data = params.action === 'upsert' ? params.args?.update : params.args?.data
  if (!data || !['active', 'role', 'password', 'orgId'].some(key => data[key] !== undefined)) return
  data.sessionVersion = { increment: 1 }
}
