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
  const v = metadata.updatedBy ?? metadata.createdBy
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

    // ✅ Auto-resolve autoria quando personId não vem, mas metadata tem createdBy/updatedBy
    let personId = input.personId ?? null

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

        if (person?.id) {
          personId = person.id
        }
      }
    }

    // ⚠️ Aviso (não quebra) para ações operacionais sem autoria
    if (!personId && String(input.action || '').startsWith('APPOINTMENT_')) {
      // evita spam: só warn, sem criar outro timeline event
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
