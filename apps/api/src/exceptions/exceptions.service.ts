import { Injectable, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { AuditService } from '../audit/audit.service'

@Injectable()
export class ExceptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(params: {
    orgId: string
    personId: string
    type: 'VACATION' | 'LEAVE' | 'PAUSE'
    reason: string
    startsAt: Date
    endsAt: Date
  }) {
    if (!params.orgId) {
      throw new BadRequestException('orgId é obrigatório')
    }

    if (params.endsAt <= params.startsAt) {
      throw new BadRequestException('Período de exceção inválido')
    }

    const person = await this.prisma.person.findFirst({
      where: { id: params.personId, orgId: params.orgId },
      select: { id: true, active: true },
    })

    if (!person) {
      throw new BadRequestException('Pessoa não encontrada para esta organização')
    }

    if (!person.active) {
      throw new BadRequestException('Pessoa está inativa')
    }

    const overlap = await this.prisma.personException.findFirst({
      where: {
        personId: params.personId,
        person: { orgId: params.orgId },
        OR: [
          {
            startsAt: { lte: params.endsAt },
            endsAt: { gte: params.startsAt },
          },
        ],
      },
    })

    if (overlap) {
      throw new BadRequestException('Já existe uma exceção ativa nesse período')
    }

    const created = await this.prisma.personException.create({
      data: {
        personId: params.personId,
        type: params.type,
        reason: params.reason,
        startsAt: params.startsAt,
        endsAt: params.endsAt,
      },
    })

    await this.audit.log({
      orgId: params.orgId,
      personId: params.personId,
      action: 'PERSON_EXCEPTION_CREATED',
      context: `${params.type}: ${params.reason}`,
    })

    return created
  }

  async listForPerson(orgId: string, personId: string) {
    if (!orgId) {
      throw new BadRequestException('orgId é obrigatório')
    }

    const personExists = await this.prisma.person.findFirst({
      where: { id: personId, orgId },
      select: { id: true },
    })

    if (!personExists) {
      throw new BadRequestException('Pessoa não encontrada para esta organização')
    }

    return this.prisma.personException.findMany({
      where: { personId, person: { orgId } },
      orderBy: { startsAt: 'desc' },
    })
  }
}
