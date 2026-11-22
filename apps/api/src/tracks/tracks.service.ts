import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { AuditService } from '../audit/audit.service'
import { AssignmentFactoryService } from '../assignments/assignment-factory.service'

/**
 * Authenticated user performing a track operation. Built by the controller exclusively from
 * `req.user` (never from the request body) and recorded as the author of the audit event.
 */
export type TrackActor = {
  userId: string | null
  personId: string | null
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

@Injectable()
export class TracksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly assignmentFactory: AssignmentFactoryService,
  ) {}

  async listForDashboard(orgId: string) {
    const tracks = await this.prisma.track.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
      include: {
        assignments: { include: { person: true } },
      },
    })

    return tracks.map(t => {
      const total = t.assignments.length
      const completed = t.assignments.filter(a => a.progress === 100).length
      const completionRate =
        total === 0 ? 0 : Math.round((completed / total) * 100)

      return {
        id: t.id,
        title: t.title,
        description: t.description,
        slug: t.slug, // ✅ necessário pro publish-latest
        status: t.status,
        version: t.version,
        createdAt: t.createdAt, // ✅ útil pra debug/ordenar/inspecionar
        peopleCount: total,
        completionRate,
      }
    })
  }

  async getById(id: string, orgId: string) {
    const track = await this.prisma.track.findFirst({
      where: { id, orgId },
      include: {
        assignments: { include: { person: true } },
      },
    })
    if (!track) throw new NotFoundException('Trilha não encontrada')
    return track
  }

  /**
   * Items of a track of the session organization, ordered by `order` (same shape as
   * GET /track-items/track/:trackId). TrackItem has no orgId: items are read only through the
   * organization-filtered track, never by trackId alone. No assignments or people are loaded.
   */
  async listItems(trackId: string, orgId: string) {
    const track = await this.prisma.track.findFirst({
      where: { id: trackId, orgId },
      select: { items: { orderBy: { order: 'asc' } } },
    })
    if (!track) throw new NotFoundException('Trilha não encontrada')
    return track.items
  }

  async create(params: {
    title: string
    description?: string
    orgId: string
    actor: TrackActor
  }) {
    const baseSlug = slugify(params.title)

    const lastVersion = await this.prisma.track.findFirst({
      where: { slug: baseSlug, orgId: params.orgId },
      orderBy: { version: 'desc' },
    })

    const version = lastVersion ? lastVersion.version + 1 : 1

    const track = await this.prisma.track.create({
      data: {
        title: params.title,
        description: params.description,
        slug: baseSlug,
        version,
        status: 'DRAFT',
        orgId: params.orgId,
      },
    })

    await this.audit.log({
      orgId: params.orgId,
      action: 'TRACK_CREATED',
      actorUserId: params.actor.userId,
      actorPersonId: params.actor.personId,
      entityType: 'TRACK',
      entityId: track.id,
      context: `Track "${track.title}" v${track.version}`,
      metadata: { trackId: track.id, slug: track.slug, version: track.version },
    })

    return track
  }

  async update(
    id: string,
    orgId: string,
    params: { title?: string; description?: string },
  ) {
    const track = await this.prisma.track.findFirst({
      where: { id, orgId },
    })

    if (!track) {
      throw new NotFoundException('Trilha não encontrada')
    }

    if (track.status !== 'DRAFT') {
      throw new BadRequestException('Somente DRAFT pode ser editada')
    }

    // Explicit field mapping: status, slug, version, orgId… can never come from the caller.
    const data: { title?: string; description?: string } = {}
    if (params.title !== undefined) data.title = params.title
    if (params.description !== undefined) data.description = params.description
    if (Object.keys(data).length === 0) return track

    return this.prisma.track.update({
      where: { id },
      data,
    })
  }

  /**
   * ✅ Regra de domínio: item sempre entra com nextOrder = max(order)+1
   * - só pode mexer em TrackItem se a Track estiver em DRAFT
   */
  async addItem(params: {
    trackId: string
    orgId: string
    type: any // (ideal: TrackItemType do Prisma, mas deixo flexível aqui)
    title: string
    content: string
    actor: TrackActor
  }) {
    const track = await this.prisma.track.findFirst({
      where: { id: params.trackId, orgId: params.orgId },
      select: { id: true, title: true, status: true, version: true },
    })

    if (!track) throw new NotFoundException('Trilha não encontrada')

    if (track.status !== 'DRAFT') {
      throw new BadRequestException('Somente DRAFT pode receber itens')
    }

    if (!params.title?.trim()) {
      throw new BadRequestException('Título do item é obrigatório')
    }

    const created = await this.prisma.$transaction(async tx => {
      const agg = await tx.trackItem.aggregate({
        where: { trackId: params.trackId },
        _max: { order: true },
      })

      const nextOrder = (agg._max.order ?? 0) + 1

      // unique(trackId, order) já existe e protege concorrência
      return tx.trackItem.create({
        data: {
          trackId: params.trackId,
          order: nextOrder,
          type: params.type,
          title: params.title.trim(),
          content: params.content ?? '',
        },
      })
    })

    await this.audit.log({
      orgId: params.orgId,
      action: 'TRACK_ITEM_CREATED',
      actorUserId: params.actor.userId,
      actorPersonId: params.actor.personId,
      entityType: 'TRACK_ITEM',
      entityId: created.id,
      metadata: { trackId: track.id, itemId: created.id, order: created.order, type: created.type, trackVersion: track.version },
      context: `Track "${track.title}" v${track.version} -> item #${created.order} "${created.title}"`,
    })

    return created
  }

  async publish(id: string, orgId: string, actor: TrackActor) {
    const track = await this.prisma.track.findFirst({
      where: { id, orgId },
    })

    if (!track) {
      throw new NotFoundException('Trilha não encontrada')
    }

    if (track.status !== 'DRAFT') {
      throw new BadRequestException('Apenas DRAFT pode ser publicada')
    }

    const itemsCount = await this.prisma.trackItem.count({
      where: { trackId: id },
    })

    if (itemsCount === 0) {
      throw new BadRequestException(
        'Não é possível publicar uma trilha sem itens',
      )
    }

    const updated = await this.prisma.track.update({
      where: { id },
      data: { status: 'ACTIVE' },
    })

    await this.audit.log({
      orgId,
      action: 'TRACK_PUBLISHED',
      actorUserId: actor.userId,
      actorPersonId: actor.personId,
      entityType: 'TRACK',
      entityId: updated.id,
      metadata: { trackId: updated.id, version: updated.version, previousStatus: track.status, status: updated.status, itemsCount },
      context: `Track "${updated.title}" v${updated.version}`,
    })

    return updated
  }

  async archive(id: string, orgId: string, actor: TrackActor) {
    const track = await this.prisma.track.findFirst({
      where: { id, orgId },
    })

    if (!track) {
      throw new NotFoundException('Trilha não encontrada')
    }

    // Both domain writes are atomic: assignments are never closed without the track being archived.
    // Semantics unchanged (open assignments still go to progress 100); the audit stays outside.
    const { updated, closedAssignments } = await this.prisma.$transaction(async (tx) => {
      // Explicit organization filters (independent of the earlier lookup and of the tenant
      // middleware): Assignment has no orgId column, so it is scoped through its track.
      const closed = await tx.assignment.updateMany({
        where: { trackId: id, track: { orgId }, progress: { lt: 100 } },
        data: { progress: 100 },
      })
      const archived = await tx.track.update({
        where: { id, orgId },
        data: { status: 'ARCHIVED' },
      })
      return { updated: archived, closedAssignments: closed.count }
    })

    await this.audit.log({
      orgId,
      action: 'TRACK_ARCHIVED',
      actorUserId: actor.userId,
      actorPersonId: actor.personId,
      entityType: 'TRACK',
      entityId: updated.id,
      metadata: { trackId: updated.id, version: updated.version, previousStatus: track.status, status: updated.status, closedAssignments },
      context: `Track "${updated.title}" v${updated.version}`,
    })

    return updated
  }

  async assignPeople(params: {
    trackId: string
    personIds: string[]
    orgId: string
  }) {
    return this.assignmentFactory.assignPeopleToTrack(params)
  }

  async unassignPeople(
    trackId: string,
    personIds: string[],
    orgId: string,
  ) {
    // Must stay before deleteMany: assignments have no orgId, this check is the tenant barrier.
    const track = await this.prisma.track.findFirst({
      where: { id: trackId, orgId },
      select: { id: true },
    })
    if (!track) throw new NotFoundException('Trilha não encontrada')

    const result = await this.prisma.assignment.deleteMany({
      where: { trackId, personId: { in: personIds } },
    })

    return { unassigned: result.count }
  }
}
