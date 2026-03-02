import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class PendingService {
  constructor(private readonly prisma: PrismaService) {}

  // 🔎 ADMIN / ORG (mantido)
  async listByOrg(orgId: string) {
    const assignments = await this.prisma.assignment.findMany({
      where: {
        person: { orgId },
        progress: { lt: 100 },
      },
      include: { person: true, track: true },
    })

    return assignments.map(a => ({
      assignmentId: a.id,
      person: a.person.name,
      track: a.track.title,
      progress: a.progress,
    }))
  }

  // 👤 USUÁRIO (fonte para /me)
  async listByPerson(personId: string) {
    const [assignments, correctives] =
      await Promise.all([
        this.prisma.assignment.findMany({
          where: {
            personId,
            progress: { lt: 100 },
          },
          include: { track: true },
        }),

        this.prisma.correctiveAction.findMany({
          where: {
            personId,
            status: 'OPEN',
          },
        }),
      ])

    const assignmentPendings = assignments.map(a => ({
      type: 'ASSIGNMENT' as const,
      id: a.id,
      title: `Trilha pendente: ${a.track.title}`,
      cta: 'Continuar trilha',
    }))

    const correctivePendings = correctives.map(c => ({
      type: 'CORRECTIVE' as const,
      id: c.id,
      title: c.reason,
      cta: 'Regularizar agora',
    }))

    const items = [
      ...correctivePendings,
      ...assignmentPendings,
    ]

    return {
      count: items.length,
      items,
    }
  }
}
