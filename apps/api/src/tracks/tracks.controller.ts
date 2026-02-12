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
   */
  @Post(':id/items')
  addItem(
    @Req() req: any,
    @Param('id') trackId: string,
    @Body()
    body: {
      type: string
      title: string
      content: string
    },
  ) {
    return this.service.addItem({
      trackId,
      orgId: req.user.orgId,
      type: body.type,
      title: body.title,
      content: body.content,
    })
  }

  /**
   * ✅ Lista itens da trilha (debug/inspeção)
   * GET /tracks/:id/items
   */
  @Get(':id/items')
  listItems(@Req() req: any, @Param('id') trackId: string) {
    // reaproveita getById pra validar orgId e existência
    return this.service.getById(trackId, req.user.orgId)
  }

  /**
   * ✅ Publicar trilha
   * POST /tracks/:id/publish
   */
  @Post(':id/publish')
  publish(@Req() req: any, @Param('id') id: string) {
    return this.service.publish(id, req.user.orgId)
  }

  /**
   * ✅ Arquivar trilha
   * POST /tracks/:id/archive
   */
  @Post(':id/archive')
  archive(@Req() req: any, @Param('id') id: string) {
    return this.service.archive(id, req.user.orgId)
  }

  /**
   * ✅ Atribuir pessoas
   * POST /tracks/:id/assign
   */
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

  /**
   * ✅ Desatribuir pessoas
   * POST /tracks/:id/unassign
   */
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
