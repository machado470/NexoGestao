import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { TimelineService } from '../timeline/timeline.service'
import { RiskService } from '../risk/risk.service'

@Injectable()
export class AssignmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly timeline: TimelineService,
    private readonly risk: RiskService,
  ) {}

  /**
   * ✅ USO INTERNO (ME)
   * PersonId vem do token (seguro)
   */
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

  /**
   * 🔒 ADMIN (ORG-SCOPED)
   * impede atravessar multi-tenant via personId
   */
  async listOpenByPersonInOrg(orgId: string, personId: string) {
    if (!orgId) throw new BadRequestException('orgId é obrigatório')
    if (!personId) throw new BadRequestException('personId é obrigatório')

    const person = await this.prisma.person.findFirst({
      where: { id: personId, orgId },
      select: { id: true },
    })

    if (!person) {
      // não revela se existe em outra org
      throw new ForbiddenException('Sem permissão para acessar esta pessoa.')
    }

    return this.listOpenByPerson(personId)
  }

  async startAssignment(assignmentId: string) {
    const assignment = await this.prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: { person: { select: { orgId: true } } },
    })

    if (!assignment) {
      throw new NotFoundException('Assignment não encontrado')
    }

    await this.timeline.log({
      orgId: assignment.person.orgId,
      action: 'ASSIGNMENT_STARTED',
      personId: assignment.personId,
      description: 'Execução da trilha iniciada',
      metadata: { assignmentId },
    })

    return assignment
  }

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

    const completedItemIds = new Set(assignment.completions.map(c => c.itemId))

    return assignment.track.items.find(item => !completedItemIds.has(item.id)) ?? null
  }

  async completeItem(assignmentId: string, itemId: string) {
    if (!itemId || itemId.trim().length === 0) {
      throw new BadRequestException('itemId é obrigatório')
    }

    const result = await this.prisma.$transaction(async tx => {
      const assignment = await tx.assignment.findUnique({
        where: { id: assignmentId },
        include: {
          person: { select: { orgId: true } },
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
        throw new BadRequestException('Trilha inválida: não possui itens')
      }

      const completedItemIds = new Set(assignment.completions.map(c => c.itemId))

      if (completedItemIds.has(itemId)) {
        throw new BadRequestException('Item já concluído')
      }

      const nextItem = assignment.track.items.find(item => !completedItemIds.has(item.id))

      if (!nextItem || nextItem.id !== itemId) {
        throw new BadRequestException('Este item não é o próximo da trilha')
      }

      await tx.trackItemCompletion.create({
        data: {
          itemId,
          personId: assignment.personId,
          assignmentId: assignment.id,
        },
      })

      const completedCount = completedItemIds.size + 1
      const progress = Math.round((completedCount / totalItems) * 100)

      await tx.assignment.update({
        where: { id: assignment.id },
        data: { progress },
      })

      return {
        orgId: assignment.person.orgId,
        personId: assignment.personId,
        progress,
        completedCount,
        totalItems,
        finished: completedCount === totalItems,
      }
    })

    await this.timeline.log({
      orgId: result.orgId,
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
        orgId: result.orgId,
        action: 'ASSIGNMENT_COMPLETED',
        personId: result.personId,
        description: 'Trilha concluída (100%)',
        metadata: {
          assignmentId,
          progress: result.progress,
        },
      })
    }

    await this.risk.recalculatePersonRisk(result.personId, 'ASSIGNMENT_PROGRESS_UPDATED')

    return {
      completed: true,
      progress: result.progress,
      finished: result.finished,
    }
  }

  async rebuildProgress(assignmentId: string) {
    const rebuilt = await this.prisma.$transaction(async tx => {
      const assignment = await tx.assignment.findUnique({
        where: { id: assignmentId },
        include: {
          person: { select: { orgId: true } },
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
          personId: assignment.personId,
          orgId: assignment.person.orgId,
        }
      }

      const completedCount = new Set(assignment.completions.map(c => c.itemId)).size
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
        orgId: assignment.person.orgId,
      }
    })

    await this.timeline.log({
      orgId: (rebuilt as any).orgId,
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

    if ((rebuilt as any).finished && (rebuilt as any).personId) {
      await this.timeline.log({
        orgId: (rebuilt as any).orgId,
        action: 'ASSIGNMENT_COMPLETED',
        personId: (rebuilt as any).personId,
        description: 'Trilha concluída (100%)',
        metadata: { assignmentId, progress: rebuilt.progress },
      })
    }

    if ((rebuilt as any).personId) {
      await this.risk.recalculatePersonRisk((rebuilt as any).personId, 'ASSIGNMENT_PROGRESS_REBUILT')
    }

    return rebuilt
  }
}
