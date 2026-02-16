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
import { TracksService } from './tracks.service'

type TrackItemTypeInput = 'READING' | 'ACTION' | 'CHECKPOINT' | 'CONTENT'

@Controller('tracks')
@UseGuards(JwtAuthGuard)
export class TracksController {
  constructor(private readonly service: TracksService) {}

  @Get()
  list(@Req() req: any) {
    return this.service.listForDashboard(req.user.orgId)
  }

  @Get(':id')
  getById(@Req() req: any, @Param('id') id: string) {
    return this.service.getById(id, req.user.orgId)
  }

  @Post()
  create(
    @Req() req: any,
    @Body()
    body: {
      title: string
      description?: string
    },
  ) {
    return this.service.create({
      title: body.title,
      description: body.description,
      orgId: req.user.orgId,
    })
  }

  @Patch(':id')
  update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { title?: string; description?: string },
  ) {
    return this.service.update(id, req.user.orgId, body)
  }

  /**
   * ✅ Cria item na trilha
   * POST /tracks/:id/items
   *
   * OBS: Prisma espera TrackItemType = READING | ACTION | CHECKPOINT.
   * Mantemos compatibilidade: CONTENT -> READING.
   */
  @Post(':id/items')
  addItem(
    @Req() req: any,
    @Param('id') trackId: string,
    @Body()
    body: {
      type: TrackItemTypeInput
      title: string
      content: string
    },
  ) {
    const normalizedType =
      body.type === 'CONTENT' ? 'READING' : body.type

    return this.service.addItem({
      trackId,
      orgId: req.user.orgId,
      type: normalizedType,
      title: body.title,
      content: body.content,
    })
  }

  /**
   * ✅ Lista itens da trilha (debug/inspeção)
   * GET /tracks/:id/items
   *
   * Nota: aqui você estava retornando a trilha, não os itens.
   * Se quiser lista de itens, use /track-items/track/:trackId
   * (mantive esse endpoint chamando getById pra não quebrar nada).
   */
  @Get(':id/items')
  listItems(@Req() req: any, @Param('id') trackId: string) {
    return this.service.getById(trackId, req.user.orgId)
  }

  @Post(':id/publish')
  publish(@Req() req: any, @Param('id') id: string) {
    return this.service.publish(id, req.user.orgId)
  }

  @Post(':id/archive')
  archive(@Req() req: any, @Param('id') id: string) {
    return this.service.archive(id, req.user.orgId)
  }

  @Post(':id/assign')
  assignPeople(
    @Req() req: any,
    @Param('id') trackId: string,
    @Body() body: { personIds: string[] },
  ) {
    return this.service.assignPeople({
      trackId,
      personIds: body.personIds ?? [],
      orgId: req.user.orgId,
    })
  }

  @Post(':id/unassign')
  unassignPeople(
    @Req() req: any,
    @Param('id') trackId: string,
    @Body() body: { personIds: string[] },
  ) {
    return this.service.unassignPeople(
      trackId,
      body.personIds ?? [],
      req.user.orgId,
    )
  }
}
