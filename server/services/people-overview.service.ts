import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import {
  OperationalStateService,
  OperationalState,
} from './operational-state.service'
import { AssignmentsService } from '../assignments/assignments.service'
import { CorrectiveActionsService } from '../corrective-actions/corrective-actions.service'

@Injectable()
export class PeopleOverviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly operationalState: OperationalStateService,
    private readonly assignments: AssignmentsService,
    private readonly correctives: CorrectiveActionsService,
  ) {}

  async getOverview(personId: string) {
    const person = await this.prisma.person.findUnique({
      where: { id: personId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        riskScore: true,
      },
    })

    if (!person) {
      throw new NotFoundException('Pessoa não encontrada')
    }

    const operational: OperationalState =
      await this.operationalState.getStatus(
        personId,
      )

    const rawAssignments =
      await this.assignments.listOpenByPerson(
        personId,
      )

    const assignments = rawAssignments.map(a => {
      let status:
        | 'NOT_STARTED'
        | 'IN_PROGRESS'
        | 'COMPLETED' = 'NOT_STARTED'

      if (a.progress > 0 && a.progress < 100)
        status = 'IN_PROGRESS'
      if (a.progress === 100)
        status = 'COMPLETED'

      return {
        id: a.id,
        progress: a.progress,
        status,
        track: {
          id: a.track.id,
          title: a.track.title,
        },
      }
    })

    const correctiveActions =
      await this.correctives.listByPerson(
        personId,
      )

    return {
      person,
      operational,
      assignments,
      correctiveActions,
    }
  }
}
