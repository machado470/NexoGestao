import { Body, Controller, Get, Param, Post } from '@nestjs/common'
import { ExceptionsService } from './exceptions.service'

@Controller('exceptions')
export class ExceptionsController {
  constructor(private readonly service: ExceptionsService) {}

  @Get('person/:personId')
  list(@Param('personId') personId: string) {
    return this.service.listForPerson(personId)
  }

  @Post()
  create(
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
      startsAt: new Date(body.startsAt),
      endsAt: new Date(body.endsAt),
    })
  }
}
