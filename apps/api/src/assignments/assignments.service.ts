import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { TimelineService } from '../timeline/timeline.service'

@Injectable()
export class AssignmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly timeline: TimelineService,
  ) {}

  async listOpenByPerson(personId: string) {
    return this.prisma.assignment.findMany({
      where: {
        personId,
        progress: { lt: 100 },
      },
      include: {
        track: true,
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async startAssignment(assignmentId: string) {
    const assignment = await this.prisma.assignment.findUnique({
      where: { id: assignmentId },
    })

    if (!assignment) {
      throw new NotFoundException('Assignment não encontrado')
    }

    // ✅ "Start" é evento. Progresso é derivado de completions.
    await this.timeline.log({
      action: 'ASSIGNMENT_STARTED',
      personId: assignment.personId,
      description: 'Execução da trilha iniciada',
      metadata: { assignmentId },
    })

    return assignment
  }

  /**
   * 🧠 PRÓXIMO ITEM DA TRILHA
   */
  async getNextItem(assignmentId: string) {
    const assignment = await this.prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: {
        track: {
          include: {
            items: { orderBy: { order: 'asc' } },
          },
        },
        completions: true,
      },
    })

    if (!assignment) {
      throw new NotFoundException('Assignment não encontrado')
    }

    const completedItemIds = new Set(
      assignment.completions.map(c => c.itemId),
    )

    return (
      assignment.track.items.find(
        item => !completedItemIds.has(item.id),
      ) ?? null
    )
  }

  /**
   * ✅ CONCLUI ITEM DA TRILHA
   * - Faz tudo em transação (completion + progress)
   * - Calcula progress sempre pelo estado real do banco
   * - Loga timeline do item e do término do assignment (100%)
   */
  async completeItem(assignmentId: string, itemId: string) {
    if (!itemId || itemId.trim().length === 0) {
      throw new BadRequestException('itemId é obrigatório')
    }

    const result = await this.prisma.$transaction(async tx => {
      const assignment = await tx.assignment.findUnique({
        where: { id: assignmentId },
        include: {
          track: {
            include: {
              items: { orderBy: { order: 'asc' } },
            },
          },
          completions: true,
        },
      })

      if (!assignment) {
        throw new NotFoundException('Assignment não encontrado')
      }

      const totalItems = assignment.track.items.length
      if (totalItems === 0) {
        throw new BadRequestException(
          'Trilha inválida: não possui itens',
        )
      }

      const completedItemIds = new Set(
        assignment.completions.map(c => c.itemId),
      )

      if (completedItemIds.has(itemId)) {
        throw new BadRequestException('Item já concluído')
      }

      const nextItem = assignment.track.items.find(
        item => !completedItemIds.has(item.id),
      )

      if (!nextItem || nextItem.id !== itemId) {
        throw new BadRequestException(
          'Este item não é o próximo da trilha',
        )
      }

      await tx.trackItemCompletion.create({
        data: {
          itemId,
          personId: assignment.personId,
          assignmentId: assignment.id,
        },
      })

      const completedCount = completedItemIds.size + 1
      const progress = Math.round(
        (completedCount / totalItems) * 100,
      )

      await tx.assignment.update({
        where: { id: assignment.id },
        data: { progress },
      })

      return {
        personId: assignment.personId,
        progress,
        completedCount,
        totalItems,
        finished: completedCount === totalItems,
      }
    })

    await this.timeline.log({
      action: 'TRACK_ITEM_COMPLETED',
      personId: result.personId,
      description: `Item concluído (${result.completedCount}/${result.totalItems})`,
      metadata: {
        assignmentId,
        itemId,
        progress: result.progress,
      },
    })

    if (result.finished) {
      await this.timeline.log({
        action: 'ASSIGNMENT_COMPLETED',
        personId: result.personId,
        description: 'Trilha concluída (100%)',
        metadata: {
          assignmentId,
          progress: result.progress,
        },
      })
    }

    return {
      completed: true,
      progress: result.progress,
      finished: result.finished,
    }
  }

  /**
   * 🛠️ Recalcula progress a partir de completions (estado real do banco)
   * Útil quando:
   * - seed recria Assignment com progress 0
   * - você insere completions via SQL
   */
  async rebuildProgress(assignmentId: string) {
    const rebuilt = await this.prisma.$transaction(async tx => {
      const assignment = await tx.assignment.findUnique({
        where: { id: assignmentId },
        include: {
          track: { include: { items: true } },
          completions: true,
        },
      })

      if (!assignment) {
        throw new NotFoundException('Assignment não encontrado')
      }

      const totalItems = assignment.track.items.length
      if (totalItems === 0) {
        return {
          rebuilt: true,
          progress: 0,
          finished: false,
          totalItems: 0,
          completedCount: 0,
        }
      }

      // completions podem estar “fora de ordem”, mas contam (estado factual)
      const completedCount = new Set(
        assignment.completions.map(c => c.itemId),
      ).size

      const progress = Math.round((completedCount / totalItems) * 100)

      await tx.assignment.update({
        where: { id: assignmentId },
        data: { progress },
      })

      return {
        rebuilt: true,
        progress,
        finished: completedCount >= totalItems,
        totalItems,
        completedCount,
        personId: assignment.personId,
      }
    })

    await this.timeline.log({
      action: 'ASSIGNMENT_PROGRESS_REBUILT',
      personId: (rebuilt as any).personId ?? null,
      description: `Progress recalculado para ${rebuilt.progress}%`,
      metadata: {
        assignmentId,
        progress: rebuilt.progress,
        totalItems: (rebuilt as any).totalItems,
        completedCount: (rebuilt as any).completedCount,
      },
    })

    // Se fechou 100% no rebuild, registra também como concluída (evento útil pro dashboard)
    if ((rebuilt as any).finished && (rebuilt as any).personId) {
      await this.timeline.log({
        action: 'ASSIGNMENT_COMPLETED',
        personId: (rebuilt as any).personId,
        description: 'Trilha concluída (100%)',
        metadata: { assignmentId, progress: rebuilt.progress },
      })
    }

    return rebuilt
  }
}
