import { Injectable, Inject } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

type TimelineLogInput = {
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
    await this.prisma.timelineEvent.create({
      data: {
        action: input.action,
        personId: input.personId ?? null,
        description: input.description ?? null,
        metadata: input.metadata ?? {},
      },
    })
  }

  async listGlobal() {
    return this.prisma.timelineEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
  }

  async listByPerson(personId: string) {
    return this.prisma.timelineEvent.findMany({
      where: { personId },
      orderBy: { createdAt: 'desc' },
    })
  }
}
