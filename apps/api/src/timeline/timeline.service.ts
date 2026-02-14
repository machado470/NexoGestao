import { Injectable, Inject } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

type TimelineLogInput = {
  orgId: string
  action: string
  personId?: string | null
  description?: string | null
  metadata?: Record<string, any> | null
}

@Injectable()
export class TimelineService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  async log(input: TimelineLogInput) {
    if (!input.orgId) {
      throw new Error('TimelineService.log(): orgId é obrigatório')
    }

    await this.prisma.timelineEvent.create({
      data: {
        orgId: input.orgId,
        action: input.action,
        personId: input.personId ?? null,
        description: input.description ?? null,
        metadata: input.metadata ?? {},
      },
    })
  }

  async listByOrg(orgId: string) {
    return this.prisma.timelineEvent.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
  }

  async listByPersonInOrg(orgId: string, personId: string) {
    return this.prisma.timelineEvent.findMany({
      where: { orgId, personId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
  }
}
