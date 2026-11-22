import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'
import { TrackItemsService } from './track-items.service'
import { CreateTrackItemDto, UpdateTrackItemDto } from './dto/track-item.dto'

// C8 PR3-2: track items are administered and read only by organization ADMINs (D1/D2).
@Controller('track-items')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TrackItemsController {
  constructor(
    private readonly service: TrackItemsService,
  ) {}

  /**
   * 📋 LISTAR ITENS DA TRILHA
   */
  @Get('track/:trackId')
  @Roles('ADMIN')
  list(
    @Req() req: any,
    @Param('trackId') trackId: string,
  ) {
    return this.service.listByTrack(
      trackId,
      req.user.orgId,
    )
  }

  /**
   * ➕ CRIAR ITEM
   */
  @Post('track/:trackId')
  @Roles('ADMIN')
  create(
    @Req() req: any,
    @Param('trackId') trackId: string,
    @Body() body: CreateTrackItemDto,
  ) {
    return this.service.create(
      trackId,
      req.user.orgId,
      { title: body.title, content: body.content, type: body.type },
    )
  }

  /**
   * ✏️ EDITAR ITEM
   */
  @Patch(':itemId')
  @Roles('ADMIN')
  update(
    @Req() req: any,
    @Param('itemId') itemId: string,
    @Body() body: UpdateTrackItemDto,
  ) {
    return this.service.update(
      itemId,
      req.user.orgId,
      { title: body.title, content: body.content },
    )
  }

  /**
   * ❌ REMOVER ITEM
   */
  @Delete(':itemId')
  @Roles('ADMIN')
  remove(
    @Req() req: any,
    @Param('itemId') itemId: string,
  ) {
    return this.service.remove(
      itemId,
      req.user.orgId,
    )
  }
}
