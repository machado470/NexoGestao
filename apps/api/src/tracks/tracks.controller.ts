import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'
import { TracksService, type TrackActor } from './tracks.service'
import { AddTrackItemDto, CreateTrackDto, TrackPeopleDto, UpdateTrackDto } from './dto/track.dto'

/** Author of an operation, taken only from the authenticated session (never from the body). */
function actorOf(req: any): TrackActor {
  const user = req?.user ?? {}
  return {
    userId: typeof (user.userId ?? user.sub) === 'string' ? (user.userId ?? user.sub) : null,
    personId: typeof user.personId === 'string' ? user.personId : null,
  }
}

// C8 PR3-2: tracks are administered and read only by organization ADMINs (D1/D2). JwtAuthGuard
// must run first so RolesGuard sees req.user; every route declares its roles explicitly.
@Controller('tracks')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TracksController {
  constructor(private readonly service: TracksService) {}

  @Get()
  @Roles('ADMIN')
  list(@Req() req: any) {
    return this.service.listForDashboard(req.user.orgId)
  }

  @Get(':id')
  @Roles('ADMIN')
  getById(@Req() req: any, @Param('id') id: string) {
    return this.service.getById(id, req.user.orgId)
  }

  @Post()
  @Roles('ADMIN')
  create(
    @Req() req: any,
    @Body() body: CreateTrackDto,
  ) {
    return this.service.create({
      title: body.title,
      description: body.description,
      orgId: req.user.orgId,
      actor: actorOf(req),
    })
  }

  @Patch(':id')
  @Roles('ADMIN')
  update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: UpdateTrackDto,
  ) {
    return this.service.update(id, req.user.orgId, {
      title: body.title,
      description: body.description,
    })
  }

  /**
   * ✅ Cria item na trilha
   * POST /tracks/:id/items
   *
   * OBS: Prisma espera TrackItemType = READING | ACTION | CHECKPOINT.
   * Mantemos compatibilidade: CONTENT -> READING.
   */
  @Post(':id/items')
  @Roles('ADMIN')
  addItem(
    @Req() req: any,
    @Param('id') trackId: string,
    @Body() body: AddTrackItemDto,
  ) {
    const normalizedType =
      body.type === 'CONTENT' ? 'READING' : body.type

    return this.service.addItem({
      trackId,
      orgId: req.user.orgId,
      type: normalizedType,
      title: body.title,
      content: body.content,
      actor: actorOf(req),
    })
  }

  /**
   * Lista os itens da trilha, ordenados por `order`.
   * GET /tracks/:id/items
   *
   * Retorna somente os itens (mesmo formato de GET /track-items/track/:trackId), sem atribuições
   * nem dados de pessoas. Trilha inexistente ou de outra organização: 404.
   */
  @Get(':id/items')
  @Roles('ADMIN')
  listItems(@Req() req: any, @Param('id') trackId: string) {
    return this.service.listItems(trackId, req.user.orgId)
  }

  @Post(':id/publish')
  @Roles('ADMIN')
  publish(@Req() req: any, @Param('id') id: string) {
    return this.service.publish(id, req.user.orgId, actorOf(req))
  }

  @Post(':id/archive')
  @Roles('ADMIN')
  archive(@Req() req: any, @Param('id') id: string) {
    return this.service.archive(id, req.user.orgId, actorOf(req))
  }

  @Post(':id/assign')
  @Roles('ADMIN')
  assignPeople(
    @Req() req: any,
    @Param('id') trackId: string,
    @Body() body: TrackPeopleDto,
  ) {
    return this.service.assignPeople({
      trackId,
      personIds: body.personIds ?? [],
      orgId: req.user.orgId,
    })
  }

  @Post(':id/unassign')
  @Roles('ADMIN')
  unassignPeople(
    @Req() req: any,
    @Param('id') trackId: string,
    @Body() body: TrackPeopleDto,
  ) {
    return this.service.unassignPeople(
      trackId,
      body.personIds ?? [],
      req.user.orgId,
    )
  }
}
