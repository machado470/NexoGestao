import {
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common'
import { NotificationsService } from './notifications.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async getMyNotifications(@Request() req) {
    const orgId = req.user.orgId
    const userId = req.user.sub
    return this.notificationsService.getNotifications(orgId, userId)
  }

  @UseGuards(JwtAuthGuard)
  @Get('unread-count')
  async getUnreadCount(@Request() req) {
    const orgId = req.user.orgId
    const userId = req.user.sub

    const unread = await this.notificationsService.getUnreadCount(orgId, userId)
    return { unread }
  }

  @UseGuards(JwtAuthGuard)
  @Post('read-all')
  async markAllAsRead(@Request() req) {
    const orgId = req.user.orgId
    const userId = req.user.sub
    return this.notificationsService.markAllAsRead(orgId, userId)
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/read')
  async markAsRead(@Request() req, @Param('id') id: string) {
    const orgId = req.user.orgId
    const userId = req.user.sub
    return this.notificationsService.markAsRead(orgId, userId, id)
  }
}
