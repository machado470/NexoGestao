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

  async listByPerson(personId: string, orgId: string) {
    // RiskSnapshot has no orgId column, so the Prisma tenant middleware cannot scope it.
    return this.prisma.riskSnapshot.findMany({
      where: { personId, person: { orgId } },
      orderBy: { createdAt: 'asc' },
    })
  }
}
