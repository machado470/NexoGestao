import { Injectable, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { AuditService } from '../audit/audit.service'
import { TimelineService } from '../timeline/timeline.service'

@Injectable()
export class PeopleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly timeline: TimelineService,
  ) {}

  async listActiveByOrg(orgId: string) {
    return this.prisma.person.findMany({
      where: {
        active: true,
        orgId,
      },
    })
  }

  async findWithContext(id: string) {
    return this.prisma.person.findUnique({
      where: { id },
      include: {
        assignments: true,
        correctiveActions: true,
        timelineEvents: {
          orderBy: { createdAt: 'desc' },
        },
      },
    })
  }

  async countUsersWithPerson() {
    return this.prisma.person.count({
      where: { userId: { not: null } },
    })
  }

  /**
   * 🧠 ATO FUNDADOR DE UMA PESSOA
   */
  async createPerson(params: {
    name: string
    role: string
    email?: string
    orgId: string
    createdBy: string
  }) {
    if (!params.name || !params.role) {
      throw new BadRequestException(
        'Nome e papel são obrigatórios',
      )
    }

    const person = await this.prisma.person.create({
      data: {
        name: params.name,
        role: params.role,
        email: params.email ?? null,
        active: true,
        riskScore: 0,
        orgId: params.orgId,
      },
    })

    // 📜 AUDIT
    await this.audit.log({
      personId: person.id,
      action: 'PERSON_CREATED',
      context: `Criada por ADMIN ${params.createdBy}`,
    })

    // 🧭 TIMELINE
    await this.timeline.log({
      action: 'PERSON_CREATED',
      personId: person.id,
      description: 'Pessoa criada no sistema',
      metadata: {
        createdBy: params.createdBy,
        role: params.role,
      },
    })

    return person
  }
}
