import { Controller, Get, Param } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Controller('persons/:id/timeline')
export class PersonsTimelineController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Param('id') personId: string) {
    return this.prisma.timelineEvent.findMany({
      where: { personId },
      orderBy: { createdAt: 'desc' },
    })
  }
}
