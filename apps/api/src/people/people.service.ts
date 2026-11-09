import { Injectable, BadRequestException, ConflictException, NotFoundException, ForbiddenException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { AuditService } from '../audit/audit.service'
import { TimelineService } from '../timeline/timeline.service'

type ActivityEvent = { input: Parameters<TimelineService['logInTransaction']>[0]; id: string }

@Injectable()
export class PeopleService {
  private static readonly MAX_DAILY_CAPACITY = 100
  private static readonly MAX_WORKLOAD_NOTES_LENGTH = 500

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

  private validateCapacityPatch(data: any) {
    for (const field of ['dailyServiceOrderCapacity', 'dailyAppointmentCapacity'] as const) {
      const value = data?.[field]
      if (value === undefined) continue
      if (!Number.isInteger(value) || value <= 0 || value > PeopleService.MAX_DAILY_CAPACITY) {
        throw new BadRequestException(`${field} deve ser um inteiro entre 1 e ${PeopleService.MAX_DAILY_CAPACITY}.`)
      }
    }
    if (data?.workloadNotes !== undefined && data.workloadNotes !== null) {
      if (typeof data.workloadNotes !== 'string' || data.workloadNotes.length > PeopleService.MAX_WORKLOAD_NOTES_LENGTH) {
        throw new BadRequestException(`workloadNotes deve ter no máximo ${PeopleService.MAX_WORKLOAD_NOTES_LENGTH} caracteres.`)
      }
    }
  }

  async listAssignees(orgId: string) {
    return this.prisma.person.findMany({
      where: { active: true, orgId },
      select: { id: true, name: true },
    })
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

  async countUsersWithPerson(orgId: string) {
    if (!orgId) throw new BadRequestException("orgId é obrigatório")
    return this.prisma.person.count({
      where: { orgId, userId: { not: null } },
    })
  }

  async updatePerson(id: string, orgId: string, data: any, actorUserId: string | null = null) {
    if (data?.active !== undefined) {
      if (typeof data.active !== 'boolean') throw new BadRequestException('active deve ser booleano.')
      return this.withActivityTransaction(orgId, actorUserId, (tx, events) =>
        this.updatePersonRecord(id, orgId, data, tx, actorUserId, events),
      )
    }
    return this.updatePersonRecord(id, orgId, data, this.prisma, actorUserId)
  }

  private async updatePersonRecord(
    id: string, orgId: string, data: any,
    db: Prisma.TransactionClient, actorUserId: string | null, events: ActivityEvent[] = [],
  ) {
    const person = await db.person.findFirst({
      where: { id, orgId },
      select: { id: true, updatedAt: true, active: true },
    })
    if (!person) throw new NotFoundException('Pessoa não encontrada')
    const expectedUpdatedAt = this.parseExpectedUpdatedAt(data?.expectedUpdatedAt)
    this.validateCapacityPatch(data)
    const activityChanged = data?.active !== undefined && data.active !== person.active
    if (activityChanged && !data.active) await this.assertCanDeactivate(db, id, orgId, actorUserId)
    const { expectedUpdatedAt: _expectedUpdatedAt, ...patch } = data ?? {}
    const mutation = await db.person.updateMany({
      where: { id, orgId, updatedAt: expectedUpdatedAt },
      data: {
        name: patch.name,
        role: patch.role,
        email: patch.email,
        active: patch.active,
        dailyServiceOrderCapacity: patch.dailyServiceOrderCapacity,
        dailyAppointmentCapacity: patch.dailyAppointmentCapacity,
        workloadNotes: patch.workloadNotes,
      },
    })
    if (mutation.count !== 1) {
      const latest = await db.person.findFirst({
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
    if (activityChanged) {
      const action = data.active ? 'PERSON_REACTIVATED' : 'PERSON_DEACTIVATED'
      await db.auditEvent.create({ data: {
        orgId, personId: id, actorUserId, action,
        entityType: 'Person', entityId: id,
        metadata: { previouslyActive: person.active, active: data.active },
      } })
      const input = {
        orgId, personId: id, action,
        description: data.active ? 'Pessoa reativada' : 'Pessoa desativada (soft delete)',
        metadata: { actorUserId, active: data.active },
      }
      const event = await this.timeline.logInTransaction(input, db)
      events.push({ input, id: event.id })
    }
    return db.person.findFirst({ where: { id, orgId } })
  }

  private async withActivityTransaction<T>(
    orgId: string, actorUserId: string | null,
    work: (tx: Prisma.TransactionClient, events: ActivityEvent[]) => Promise<T>,
  ): Promise<T> {
    const events: ActivityEvent[] = []
    const result = await this.prisma.$transaction(async tx => {
      await this.lockActivityChange(tx, orgId, actorUserId)
      return work(tx, events)
    })
    // External delivery only sees committed evidence, never a rolled-back event.
    for (const event of events) {
      await this.timeline.dispatchPersistedEventWebhook(event.input, event.id)
    }
    return result
  }

  private async lockActivityChange(tx: Prisma.TransactionClient, orgId: string, actorUserId: string | null) {
    // Share the member-administration lock and revalidate an actor that may have waited for it.
    await tx.$queryRaw(Prisma.sql`SELECT id FROM "Organization" WHERE id = ${orgId} FOR UPDATE`)
    if (actorUserId) {
      const actor = await tx.user.findFirst({ where: {
        id: actorUserId, orgId, role: 'ADMIN', active: true, person: { is: { active: true } },
      } })
      if (!actor) throw new ForbiddenException('Somente administradores ativos podem alterar acessos.')
    }
  }

  private async assertCanDeactivate(tx: Prisma.TransactionClient, id: string, orgId: string, actorUserId: string | null) {
    const activeOS = await tx.serviceOrder.count({ where: {
      orgId, assignedToPersonId: id, status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS'] },
    } })
    if (activeOS > 0) {
      throw new BadRequestException(`Pessoa possui ${activeOS} ordem(ns) de serviço ativa(s). Finalize ou reatribua antes de desativar.`)
    }
    const admin = await tx.user.findFirst({ where: {
      orgId, active: true, role: 'ADMIN', person: { is: { id, orgId, active: true } },
    } })
    if (admin) {
      if (admin.id === actorUserId) {
        throw new BadRequestException('Peça a outro administrador para alterar seu próprio acesso.')
      }
      const others = await tx.user.count({ where: {
        orgId, id: { not: admin.id }, active: true, role: 'ADMIN', person: { is: { active: true } },
      } })
      if (others === 0) throw new BadRequestException('A organização deve manter pelo menos um administrador ativo.')
    }
  }

  /** Both entry points use the same transaction, protections and authoritative evidence. */
  async deactivatePerson(id: string, orgId: string, actorUserId: string | null) {
    return this.withActivityTransaction(orgId, actorUserId, async (tx, events) => {
      const person = await tx.person.findFirst({ where: { id, orgId } })
      if (!person) throw new NotFoundException('Pessoa não encontrada')
      if (!person.active) return { ok: true, message: 'Pessoa já estava inativa', person }
      const updated = await this.updatePersonRecord(id, orgId, {
        active: false, expectedUpdatedAt: person.updatedAt.toISOString(),
      }, tx, actorUserId, events)
      return { ok: true, person: updated }
    })
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
