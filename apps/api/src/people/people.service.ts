import { Injectable, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common'
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

  private parseExpectedUpdatedAt(value?: string): Date {
    if (!value) {
      throw new BadRequestException({
        code: 'EXPECTED_UPDATED_AT_REQUIRED',
        message: 'expectedUpdatedAt é obrigatório para atualizar pessoa.',
      })
    }
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('expectedUpdatedAt inválido (use ISO)')
    }
    return parsed
  }

  async listActiveByOrg(orgId: string) {
    return this.prisma.person.findMany({
      where: {
        active: true,
        orgId,
      },
    })
  }

  async findWithContext(id: string, orgId: string) {
    return this.prisma.person.findFirst({
      where: { id, orgId },
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

  async updatePerson(id: string, orgId: string, data: any) {
    const person = await this.prisma.person.findFirst({
      where: { id, orgId },
      select: { id: true, updatedAt: true, active: true },
    })
    if (!person) throw new NotFoundException('Pessoa não encontrada')
    const expectedUpdatedAt = this.parseExpectedUpdatedAt(data?.expectedUpdatedAt)
    const { expectedUpdatedAt: _expectedUpdatedAt, ...patch } = data ?? {}
    const mutation = await this.prisma.person.updateMany({
      where: { id, orgId, updatedAt: expectedUpdatedAt },
      data: {
        name: patch.name,
        role: patch.role,
        email: patch.email,
        active: patch.active,
      },
    })
    if (mutation.count !== 1) {
      const latest = await this.prisma.person.findFirst({
        where: { id, orgId },
        select: { id: true, updatedAt: true, active: true },
      })
      if (!latest) throw new NotFoundException('Pessoa não encontrada')
      throw new ConflictException({
        code: 'PERSON_CONCURRENT_MODIFICATION',
        message:
          'Pessoa foi alterada por outra operação. Recarregue antes de salvar.',
        details: {
          personId: latest.id,
          currentUpdatedAt: latest.updatedAt,
          active: latest.active,
        },
      })
    }
    return this.prisma.person.findFirst({ where: { id, orgId } })
  }

  /**
   * Soft delete: desativa a pessoa sem remover do banco.
   * Bloqueia se houver OS ativa vinculada à pessoa.
   * Gera audit + timeline conforme regras do sistema.
   */
  async deactivatePerson(id: string, orgId: string, actorUserId: string | null) {
    const person = await this.prisma.person.findFirst({ where: { id, orgId } })
    if (!person) throw new NotFoundException('Pessoa não encontrada')
    if (!person.active) {
      return { ok: true, message: 'Pessoa já estava inativa', person }
    }

    // Bloqueia se há OS ativa vinculada à pessoa
    const activeOS = await this.prisma.serviceOrder.count({
      where: {
        orgId,
        assignedToPersonId: id,
        status: { in: ['OPEN', 'IN_PROGRESS'] },
      },
    })
    if (activeOS > 0) {
      throw new BadRequestException(
        `Pessoa possui ${activeOS} ordem(ns) de serviço ativa(s). Finalize ou reatribua antes de desativar.`,
      )
    }

    const updated = await this.prisma.person.update({
      where: { id },
      data: { active: false },
    })

    await this.audit.log({
      personId: id,
      action: 'PERSON_DEACTIVATED',
      context: actorUserId
        ? `Desativado por ADMIN ${actorUserId}`
        : 'Desativado pelo sistema',
    })

    await this.timeline.log({
      orgId,
      action: 'PERSON_DEACTIVATED',
      personId: id,
      description: 'Pessoa desativada (soft delete)',
      metadata: { deactivatedBy: actorUserId },
    })

    return { ok: true, person: updated }
  }

  async createPerson(params: {
    name: string
    role: string
    email?: string
    orgId: string
    createdBy: string
  }) {
    if (!params.name || !params.role) {
      throw new BadRequestException('Nome e papel são obrigatórios')
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

    await this.audit.log({
      personId: person.id,
      action: 'PERSON_CREATED',
      context: `Criada por ADMIN ${params.createdBy}`,
    })

    await this.timeline.log({
      orgId: params.orgId,
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
