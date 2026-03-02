import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class PersonSuspensionService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async isSuspended(personId: string): Promise<boolean> {
    const now = new Date()

    const activeException =
      await this.prisma.personException.findFirst({
        where: {
          personId,
          startsAt: { lte: now },
          endsAt: { gte: now },
        },
        select: { id: true },
      })

    return !!activeException
  }
}
