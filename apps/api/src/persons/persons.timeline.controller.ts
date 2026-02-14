import {
  Controller,
  Get,
  Param,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { PrismaService } from '../prisma/prisma.service'
import { Org } from '../auth/decorators/org.decorator'
import { TimelineService } from '../timeline/timeline.service'

@Controller('persons/:id/timeline')
@UseGuards(JwtAuthGuard)
export class PersonsTimelineController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly timeline: TimelineService,
  ) {}

  @Get()
  async list(@Org() orgId: string, @Param('id') personId: string) {
    const person = await this.prisma.person.findFirst({
      where: { id: personId, orgId },
      select: { id: true },
    })

    if (!person) {
      throw new ForbiddenException('Pessoa não pertence à sua organização.')
    }

    return this.timeline.listByPersonInOrg(orgId, personId)
  }
}
