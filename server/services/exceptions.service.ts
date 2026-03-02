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
    personId: string
    type: 'VACATION' | 'LEAVE' | 'PAUSE'
    reason: string
    startsAt: Date
    endsAt: Date
  }) {
    // 1️⃣ Regra básica de período
    if (params.endsAt <= params.startsAt) {
      throw new BadRequestException(
        'Período de exceção inválido',
      )
    }

    // 2️⃣ Pessoa precisa existir
    const person = await this.prisma.person.findUnique({
      where: { id: params.personId },
      select: { id: true, active: true },
    })

    if (!person) {
      throw new BadRequestException(
        'Pessoa não encontrada',
      )
    }

    if (!person.active) {
      throw new BadRequestException(
        'Pessoa está inativa',
      )
    }

    // 3️⃣ Não permitir exceções sobrepostas
    const overlap = await this.prisma.personException.findFirst({
      where: {
        personId: params.personId,
        OR: [
          {
            startsAt: { lte: params.endsAt },
            endsAt: { gte: params.startsAt },
          },
        ],
      },
    })

    if (overlap) {
      throw new BadRequestException(
        'Já existe uma exceção ativa nesse período',
      )
    }

    // 4️⃣ Criar exceção
    const created =
      await this.prisma.personException.create({
        data: params,
      })

    // 5️⃣ Auditoria
    await this.audit.log({
      personId: params.personId,
      action: 'PERSON_EXCEPTION_CREATED',
      context: `${params.type}: ${params.reason}`,
    })

    return created
  }

  async listForPerson(personId: string) {
    // Pessoa inválida → lista vazia explícita
    const personExists =
      await this.prisma.person.findUnique({
        where: { id: personId },
        select: { id: true },
      })

    if (!personExists) {
      throw new BadRequestException(
        'Pessoa não encontrada',
      )
    }

    return this.prisma.personException.findMany({
      where: { personId },
      orderBy: { startsAt: 'desc' },
    })
  }
}
