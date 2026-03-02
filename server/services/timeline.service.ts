import { Injectable, Inject } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { TimelineQueryDto } from './dto/timeline-query.dto'

type TimelineLogInput = {
  orgId: string
  action: string
  personId?: string | null
  description?: string | null
  metadata?: Record<string, any> | null
}

function pickActorUserId(metadata?: Record<string, any> | null): string | null {
  if (!metadata) return null

  // padrão novo
  const v1 = metadata.actorUserId
  if (typeof v1 === 'string' && v1.trim()) return v1.trim()

  // compat legado
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

    // 1) se veio personId explícito
    let personId = input.personId ?? null

    // 2) se não veio, tenta metadata.actorPersonId e valida no org
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

    // 3) fallback por userId (actorUserId / createdBy / updatedBy)
    if (!personId) {
      const actorUserId = pickActorUserId(input.metadata ?? null)

      if (actorUserId) {
        const person = await this.prisma.person.findFirst({
          where: { orgId: input.orgId, userId: actorUserId },
          select: { id: true },
        })

        if (person?.id) personId = person.id
      }
    }

    // aviso (não quebra) para ações sem autoria
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

  /**
   * ✅ query é opcional (compat com callers antigos)
   */
  async listByOrg(orgId: string, query?: TimelineQueryDto) {
    const take =
      (query as any)?.limit && Number((query as any).limit) > 0
        ? Math.min(Number((query as any).limit), 200)
        : 50

    const action = (query as any)?.action
    const personId = (query as any)?.personId

    return this.prisma.timelineEvent.findMany({
      where: {
        orgId,
        ...(action ? { action: String(action) } : {}),
        ...(personId ? { personId: String(personId) } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take,
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
