import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class PersonAvailabilityExceptionsService {
  private static readonly MAX_REASON_LENGTH = 200

  constructor(private readonly prisma: PrismaService) {}

  private async requirePerson(personId: string, orgId: string) {
    const person = await this.prisma.person.findFirst({ where: { id: personId, orgId }, select: { id: true } })
    if (!person) throw new NotFoundException('Pessoa não encontrada')
    return person
  }

  private parseDate(value: string, field: string) {
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) throw new BadRequestException(`${field} inválido (use ISO)`)
    return parsed
  }

  async list(personId: string, orgId: string) {
    await this.requirePerson(personId, orgId)
    return this.prisma.personAvailabilityException.findMany({
      where: { orgId, personId },
      orderBy: { startsAt: 'desc' },
    })
  }

  async create(personId: string, orgId: string, input: { startsAt: string; endsAt: string; reason?: string | null }) {
    await this.requirePerson(personId, orgId)
    const startsAt = this.parseDate(input.startsAt, 'startsAt')
    const endsAt = this.parseDate(input.endsAt, 'endsAt')
    if (startsAt >= endsAt) throw new BadRequestException('startsAt deve ser anterior a endsAt')
    const reason = input.reason?.trim() || null
    if (reason && reason.length > PersonAvailabilityExceptionsService.MAX_REASON_LENGTH) {
      throw new BadRequestException(`reason deve ter no máximo ${PersonAvailabilityExceptionsService.MAX_REASON_LENGTH} caracteres.`)
    }
    return this.prisma.personAvailabilityException.create({ data: { orgId, personId, startsAt, endsAt, reason } })
  }

  async delete(personId: string, exceptionId: string, orgId: string) {
    await this.requirePerson(personId, orgId)
    const result = await this.prisma.personAvailabilityException.deleteMany({ where: { id: exceptionId, personId, orgId } })
    if (result.count !== 1) throw new NotFoundException('Indisponibilidade não encontrada')
    return { ok: true, id: exceptionId }
  }
}
