import { Injectable, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { TimelineService } from '../timeline/timeline.service'
import { RiskService } from '../risk/risk.service'

@Injectable()
export class AssignmentFactoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly timeline: TimelineService,
    private readonly risk: RiskService,
  ) {}

  async assignPeopleToTrack(params: {
    trackId: string
    personIds: string[]
    orgId: string
  }) {
    const track = await this.prisma.track.findFirst({
      where: {
        id: params.trackId,
        orgId: params.orgId,
        status: 'ACTIVE',
      },
    })

    if (!track) {
      throw new BadRequestException('Trilha não ativa')
    }

    const people = await this.prisma.person.findMany({
      where: {
        id: { in: params.personIds ?? [] },
        orgId: params.orgId,
        active: true,
        role: 'COLLABORATOR',
      },
      select: { id: true },
    })

    const personIds = people.map(p => p.id)
    if (personIds.length === 0) {
      return { assigned: 0 }
    }

    const result = await this.prisma.$transaction(async tx => {
      const existing = await tx.assignment.findMany({
        where: {
          trackId: track.id,
          personId: { in: personIds },
        },
        select: { personId: true },
      })

      const existingSet = new Set(existing.map(e => e.personId))
      const toCreate = personIds
        .filter(pid => !existingSet.has(pid))
        .map(pid => ({
          personId: pid,
          trackId: track.id,
          progress: 0,
        }))

      if (toCreate.length === 0) {
        return { createdIds: [] as string[], createdCount: 0 }
      }

      await tx.assignment.createMany({
        data: toCreate,
        skipDuplicates: true,
      })

      const created = await tx.assignment.findMany({
        where: {
          trackId: track.id,
          personId: { in: toCreate.map(x => x.personId) },
        },
        select: { personId: true },
      })

      return {
        createdIds: created.map(c => c.personId),
        createdCount: created.length,
      }
    })

    // Timeline: atribuição criada
    await Promise.all(
      result.createdIds.map(personId =>
        this.timeline.log({
          orgId: params.orgId,
          action: 'ASSIGNMENT_CREATED',
          personId,
          description: `Trilha "${track.title}" atribuída`,
          metadata: { trackId: track.id },
        }),
      ),
    )

    // PUSH: recalc risco imediatamente (fecha o loop)
    await Promise.all(
      result.createdIds.map(personId =>
        this.risk.recalculatePersonRisk(personId, 'ASSIGNMENT_CREATED'),
      ),
    )

    return { assigned: result.createdCount }
  }
}
