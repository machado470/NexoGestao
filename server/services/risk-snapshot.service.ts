import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class RiskSnapshotService {
  constructor(private readonly prisma: PrismaService) {}

  async record(params: {
    personId: string
    score: number
    reason: string
  }) {
    return this.prisma.riskSnapshot.create({
      data: {
        personId: params.personId,
        score: params.score,
        reason: params.reason,
      },
    })
  }

  async listByPerson(personId: string) {
    return this.prisma.riskSnapshot.findMany({
      where: { personId },
      orderBy: { createdAt: 'asc' },
    })
  }
}
