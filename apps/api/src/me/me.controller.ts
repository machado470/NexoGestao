import {
  Controller,
  Get,
  Req,
  UseGuards,
} from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { AssignmentsService } from '../assignments/assignments.service'
import {
  OperationalStateService,
  OperationalState,
} from '../people/operational-state.service'
import { PrismaService } from '../prisma/prisma.service'
import { PendingService } from '../pending/pending.service'

type OperationalView = {
  state: string
  severity: 'success' | 'warning' | 'danger'
  message: string
  riskScore: number
  cta?: string
}

type PendingItem =
  | {
      type: 'CORRECTIVE'
      id: string
      title: string
      cta: string
    }
  | {
      type: 'ASSIGNMENT'
      id: string
      title: string
      cta: string
    }

type PendingView = {
  count: number
  items: PendingItem[]
}

@Controller('me')
@UseGuards(JwtAuthGuard)
export class MeController {
  constructor(
    private readonly assignments: AssignmentsService,
    private readonly operationalState: OperationalStateService,
    private readonly prisma: PrismaService,
    private readonly pending: PendingService,
  ) {}

  @Get()
  async me(@Req() req: any) {
    const { sub, role, orgId, personId } = req.user

    let operational: OperationalState = {
      state: 'NORMAL',
      riskScore: 0,
    }

    let pending: PendingView = {
      count: 0,
      items: [],
    }

    if (personId) {
      operational =
        await this.operationalState.getStatus(personId)

      pending =
        await this.pending.listByPerson(personId)
    }

    const operationalView =
      this.translateOperationalState(
        operational,
        pending.count,
      )

    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { requiresOnboarding: true },
    })

    const rawAssignments = personId
      ? await this.assignments.listOpenByPerson(
          personId,
        )
      : []

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

    return {
      user: {
        id: sub,
        role,
        orgId,
        personId,
      },
      operational: operationalView,
      pending,
      assignments,
      requiresOnboarding:
        org?.requiresOnboarding ?? false,
    }
  }

  private translateOperationalState(
    operational: OperationalState,
    pendingCount: number,
  ): OperationalView {
    if (pendingCount > 0 && operational.state === 'NORMAL') {
      return {
        state: 'WARNING',
        severity: 'warning',
        riskScore: operational.riskScore,
        message:
          'Existem pendências que precisam da sua atenção.',
        cta: 'Ver pendências',
      }
    }

    switch (operational.state) {
      case 'RESTRICTED':
        return {
          state: 'RESTRICTED',
          severity: 'danger',
          riskScore: operational.riskScore,
          message:
            'Seu acesso está temporariamente restrito.',
          cta: 'Regularizar agora',
        }

      case 'SUSPENDED':
        return {
          state: 'SUSPENDED',
          severity: 'danger',
          riskScore: operational.riskScore,
          message:
            'Usuário suspenso temporariamente.',
        }

      default:
        return {
          state: 'NORMAL',
          severity: 'success',
          riskScore: operational.riskScore,
          message:
            'Tudo certo. Nenhuma ação necessária.',
        }
    }
  }
}
