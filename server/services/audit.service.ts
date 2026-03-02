import { BadRequestException, Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import type { AuditAction } from './audit.actions'

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  private async resolveOrgId(params: {
    orgId?: string | null
    personId?: string | null
  }): Promise<string> {
    if (params.orgId) return params.orgId

    if (params.personId) {
      const p = await this.prisma.person.findUnique({
        where: { id: params.personId },
        select: { orgId: true },
      })
      if (p?.orgId) return p.orgId
    }

    throw new BadRequestException(
      'orgId é obrigatório (ou informe personId para resolver orgId automaticamente)',
    )
  }

  async log(params: {
    orgId?: string | null
    action: AuditAction | string

    // autoria (quem fez)
    actorUserId?: string | null
    actorPersonId?: string | null

    // compat legado (se quiser preencher)
    personId?: string | null

    // entidade afetada
    entityType?: string | null
    entityId?: string | null

    // descrição humana curta
    context?: string | null

    // dados estruturados
    metadata?: Record<string, any> | null
  }) {
    const orgId = await this.resolveOrgId({
      orgId: params.orgId ?? null,
      personId: params.personId ?? null,
    })

    return this.prisma.auditEvent.create({
      data: {
        orgId,
        action: params.action,

        actorUserId: params.actorUserId ?? null,
        actorPersonId: params.actorPersonId ?? null,

        // legado
        personId: params.personId ?? null,

        entityType: params.entityType ?? null,
        entityId: params.entityId ?? null,

        context: params.context ?? null,
        metadata: params.metadata ?? {},
      },
    })
  }

  async listLatest(params?: { orgId?: string; limit?: number }) {
    const limit = params?.limit ?? 50

    return this.prisma.auditEvent.findMany({
      where: params?.orgId ? { orgId: params.orgId } : undefined,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        person: { select: { name: true } },
      },
    })
  }
}
