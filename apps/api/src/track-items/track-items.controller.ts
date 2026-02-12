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
import { TrackItemsService } from './track-items.service'

@Controller('track-items')
@UseGuards(JwtAuthGuard)
export class TrackItemsController {
  constructor(
    private readonly service: TrackItemsService,
  ) {}

  /**
   * 📋 LISTAR ITENS DA TRILHA
   */
  @Get('track/:trackId')
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
  create(
    @Req() req: any,
    @Param('trackId') trackId: string,
    @Body()
    body: {
      title: string
      content?: string
      type: 'READING' | 'ACTION' | 'CHECKPOINT'
    },
  ) {
    return this.service.create(
      trackId,
      req.user.orgId,
      body,
    )
  }

  /**
   * ✏️ EDITAR ITEM
   */
  @Patch(':itemId')
  update(
    @Req() req: any,
    @Param('itemId') itemId: string,
    @Body()
    body: {
      title?: string
      content?: string
    },
  ) {
    return this.service.update(
      itemId,
      req.user.orgId,
      body,
    )
  }

  /**
   * ❌ REMOVER ITEM
   */
  @Delete(':itemId')
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
