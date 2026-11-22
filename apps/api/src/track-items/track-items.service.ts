import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { TrackStatus } from '@prisma/client'

@Injectable()
export class TrackItemsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 📋 LISTA ITENS DA TRILHA (ORDENADOS)
   */
  async listByTrack(trackId: string, orgId: string) {
    const track = await this.prisma.track.findFirst({
      where: { id: trackId, orgId },
      include: {
        items: { orderBy: { order: 'asc' } },
      },
    })

    if (!track) {
      throw new NotFoundException('Trilha não encontrada')
    }

    return track.items
  }

  /**
   * ➕ CRIAR ITEM (APENAS DRAFT)
   */
  async create(
    trackId: string,
    orgId: string,
    params: {
      title: string
      content?: string
      type: 'READING' | 'ACTION' | 'CHECKPOINT'
    },
  ) {
    const track = await this.prisma.track.findFirst({
      where: { id: trackId, orgId },
      include: { items: true },
    })

    if (!track) {
      throw new NotFoundException('Trilha não encontrada')
    }

    if (track.status !== TrackStatus.DRAFT) {
      throw new BadRequestException(
        'Somente trilhas DRAFT podem ser editadas',
      )
    }

    const nextOrder = track.items.length + 1

    return this.prisma.trackItem.create({
      data: {
        trackId,
        title: params.title,
        content: params.content,
        type: params.type,
        order: nextOrder,
      },
    })
  }

  /**
   * ✏️ ATUALIZAR ITEM (APENAS DRAFT)
   */
  async update(
    itemId: string,
    orgId: string,
    params: {
      title?: string
      content?: string
    },
  ) {
    const item = await this.prisma.trackItem.findFirst({
      where: {
        id: itemId,
        track: { orgId },
      },
      include: { track: true },
    })

    if (!item) {
      throw new NotFoundException('Item não encontrado')
    }

    if (item.track.status !== TrackStatus.DRAFT) {
      throw new BadRequestException(
        'Somente trilhas DRAFT podem ser editadas',
      )
    }

    // Explicit field mapping: trackId, order and type can never come from the caller, so an item
    // cannot be moved to another track (TrackItem has no orgId column for the tenant middleware).
    const data: { title?: string; content?: string } = {}
    if (params.title !== undefined) data.title = params.title
    if (params.content !== undefined) data.content = params.content
    if (Object.keys(data).length === 0) {
      const { track: _track, ...current } = item
      return current
    }

    return this.prisma.trackItem.update({
      where: { id: itemId },
      data,
    })
  }

  /**
   * ❌ REMOVER ITEM + REORDENAR
   */
  async remove(itemId: string, orgId: string) {
    const item = await this.prisma.trackItem.findFirst({
      where: {
        id: itemId,
        track: { orgId },
      },
      include: { track: true },
    })

    if (!item) {
      throw new NotFoundException('Item não encontrado')
    }

    if (item.track.status !== TrackStatus.DRAFT) {
      throw new BadRequestException(
        'Somente trilhas DRAFT podem ser editadas',
      )
    }

    await this.prisma.trackItem.delete({
      where: { id: itemId },
    })

    // 🔄 Reordenar
    const remaining = await this.prisma.trackItem.findMany({
      where: { trackId: item.trackId },
      orderBy: { order: 'asc' },
    })

    await Promise.all(
      remaining.map((i, index) =>
        this.prisma.trackItem.update({
          where: { id: i.id },
          data: { order: index + 1 },
        }),
      ),
    )

    return { removed: true }
  }
}
