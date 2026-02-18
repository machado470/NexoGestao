import { Injectable, Inject } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

type TimelineLogInput = {
  orgId: string
  action: string
  personId?: string | null
  description?: string | null
  metadata?: Record<string, any> | null
}

function pickActorUserId(metadata?: Record<string, any> | null): string | null {
  if (!metadata) return null

  // ✅ padrão novo
  const v1 = metadata.actorUserId
  if (typeof v1 === 'string' && v1.trim()) return v1.trim()

  // ✅ compat legado (já existe no sistema)
  const v2 = metadata.updatedBy ?? metadata.createdBy
  if (typeof v2 !== 'string') return null
  const s = v2.trim()
  return s ? s : null
}

function pickActorPersonId(metadata?: Record<string, any> | null): string | null {
  if (!metadata) return null
  const v = metadata.actorPersonId
  if (typeof v !== 'string') return null
  const s = v.trim()
  return s ? s : null
}

@Injectable()
export class TimelineService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  async log(input: TimelineLogInput) {
    if (!input.orgId) {
      throw new Error('TimelineService.log(): orgId é obrigatório')
    }

    // ✅ 1) Se veio personId explícito, perfeito.
    let personId = input.personId ?? null

    // ✅ 2) Se não veio, tenta metadata.actorPersonId (padrão novo) e valida no org
    if (!personId) {
      const actorPersonId = pickActorPersonId(input.metadata ?? null)

      if (actorPersonId) {
        const exists = await this.prisma.person.findFirst({
          where: { id: actorPersonId, orgId: input.orgId },
          select: { id: true },
        })
        if (exists?.id) personId = exists.id
      }
    }

    // ✅ 3) Se ainda não veio, tenta resolver por userId (actorUserId / createdBy / updatedBy)
    if (!personId) {
      const actorUserId = pickActorUserId(input.metadata ?? null)

      if (actorUserId) {
        const person = await this.prisma.person.findFirst({
          where: {
            orgId: input.orgId,
            userId: actorUserId,
          },
          select: { id: true },
        })

        if (person?.id) personId = person.id
      }
    }

    // ⚠️ Aviso (não quebra) para ações operacionais sem autoria
    if (!personId && String(input.action || '').startsWith('APPOINTMENT_')) {
      console.warn(
        '[Timeline] APPOINTMENT_* sem personId. action=%s orgId=%s metadataKeys=%s',
        input.action,
        input.orgId,
        input.metadata ? Object.keys(input.metadata).join(',') : '',
      )
    }

    await this.prisma.timelineEvent.create({
      data: {
        orgId: input.orgId,
        action: input.action,
        personId,
        description: input.description ?? null,
        metadata: input.metadata ?? {},
      },
    })
  }

  async listByOrg(orgId: string) {
    return this.prisma.timelineEvent.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
  }

  async listByPersonInOrg(orgId: string, personId: string) {
    return this.prisma.timelineEvent.findMany({
      where: { orgId, personId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
  }
}
