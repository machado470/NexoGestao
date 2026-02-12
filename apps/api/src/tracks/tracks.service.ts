import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { AuditService } from '../audit/audit.service'
import { AssignmentFactoryService } from '../assignments/assignment-factory.service'

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
    return this.prisma.track.findFirstOrThrow({
      where: { id, orgId },
      include: {
        assignments: { include: { person: true } },
      },
    })
  }

  async create(params: {
    title: string
    description?: string
    orgId: string
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
      action: 'TRACK_CREATED',
      context: `Track "${track.title}" v${track.version}`,
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

    return this.prisma.track.update({
      where: { id },
      data: params,
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
      action: 'TRACK_ITEM_CREATED',
      context: `Track "${track.title}" v${track.version} -> item #${created.order} "${created.title}"`,
    })

    return created
  }

  async publish(id: string, orgId: string) {
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
      action: 'TRACK_PUBLISHED',
      context: `Track "${updated.title}" v${updated.version}`,
    })

    return updated
  }

  async archive(id: string, orgId: string) {
    const track = await this.prisma.track.findFirst({
      where: { id, orgId },
    })

    if (!track) {
      throw new NotFoundException('Trilha não encontrada')
    }

    await this.prisma.assignment.updateMany({
      where: { trackId: id, progress: { lt: 100 } },
      data: { progress: 100 },
    })

    const updated = await this.prisma.track.update({
      where: { id },
      data: { status: 'ARCHIVED' },
    })

    await this.audit.log({
      action: 'TRACK_ARCHIVED',
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
    await this.prisma.track.findFirstOrThrow({
      where: { id: trackId, orgId },
    })

    const result = await this.prisma.assignment.deleteMany({
      where: { trackId, personId: { in: personIds } },
    })

    return { unassigned: result.count }
  }
}
