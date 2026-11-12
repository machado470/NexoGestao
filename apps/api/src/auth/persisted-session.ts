import { UnauthorizedException } from '@nestjs/common'
import type { PrismaService } from '../prisma/prisma.service'

/** Shared persisted identity check after JWT signature/expiry verification. */
export async function validatePersistedSession(prisma: Pick<PrismaService, 'user'>, payload: any) {
  if (typeof payload?.sub !== 'string' || typeof payload?.orgId !== 'string' ||
      !Number.isInteger(payload?.sessionVersion) || payload.sessionVersion < 0) {
    throw new UnauthorizedException('Sessão inválida. Entre novamente.')
  }
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, orgId: true, role: true, active: true, sessionVersion: true,
      person: { select: { id: true, active: true } } },
  })
  if (!user || !user.active || !user.person?.active ||
      user.orgId !== payload.orgId || user.role !== payload.role ||
      user.person.id !== payload.personId || user.sessionVersion !== payload.sessionVersion) {
    throw new UnauthorizedException('Sessão revogada. Entre novamente.')
  }
  return { sub: user.id, userId: user.id, role: user.role, orgId: user.orgId,
    personId: user.person.id, sessionVersion: user.sessionVersion, exp: payload.exp }
}
