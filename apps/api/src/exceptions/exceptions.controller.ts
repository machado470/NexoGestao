import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common'
import { Org } from '../auth/decorators/org.decorator'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { ExceptionsService } from './exceptions.service'

@Controller('exceptions')
@UseGuards(JwtAuthGuard)
export class ExceptionsController {
  constructor(private readonly service: ExceptionsService) {}

  @Get('person/:personId')
  list(@Org() orgId: string, @Param('personId') personId: string) {
    return this.service.listForPerson(orgId, personId)
  }

  @Post()
  create(
    @Org() orgId: string,
    @Body()
    body: {
      personId: string
      type: 'VACATION' | 'LEAVE' | 'PAUSE'
      reason: string
      startsAt: string
      endsAt: string
    },
  ) {
    return this.service.create({
      ...body,
      orgId,
      startsAt: new Date(body.startsAt),
      endsAt: new Date(body.endsAt),
    })
  }
}
