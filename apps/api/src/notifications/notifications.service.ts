import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { NotificationType } from '@prisma/client'
import { QueueService } from '../queue/queue.service'
import { QUEUE_NAMES } from '../queue/queue.constants'

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private readonly queueService: QueueService,
  ) {}

  async enqueueNotification(
    orgId: string,
    type: NotificationType,
    message: string,
    userId?: string,
    metadata?: any,
  ) {
    return this.queueService.addJob(
      QUEUE_NAMES.NOTIFICATIONS,
      'create-notification',
      { orgId, type, message, userId, metadata },
    )
  }

  async createNotificationNow(
    orgId: string,
    type: NotificationType,
    message: string,
    userId?: string,
    metadata?: any,
  ) {
    return this.prisma.notification.create({
      data: {
        orgId,
        userId,
        type,
        message,
        metadata,
      },
    })
  }

  async createNotification(
    orgId: string,
    type: NotificationType,
    message: string,
    userId?: string,
    metadata?: any,
  ) {
    return this.createNotificationNow(orgId, type, message, userId, metadata)
  }

  async getNotifications(orgId: string, userId?: string) {
    const where: any = { orgId }
    if (userId) {
      where.OR = [{ userId }, { userId: null }]
    }
    return this.prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })
  }

  async getUnreadCount(orgId: string, userId: string) {
    return this.prisma.notification.count({
      where: {
        orgId,
        readAt: null,
        OR: [{ userId }, { userId: null }],
      },
    })
  }

  async markAsRead(orgId: string, userId: string, notificationId: string) {
    const result = await this.prisma.notification.updateMany({
      where: {
        id: notificationId,
        orgId,
        OR: [{ userId }, { userId: null }],
      },
      data: { readAt: new Date() },
    })

    if (result.count === 0) {
      throw new NotFoundException('Notificação não encontrada')
    }

    return { ok: true }
  }

  async markAllAsRead(orgId: string, userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: {
        orgId,
        readAt: null,
        OR: [{ userId }, { userId: null }],
      },
      data: { readAt: new Date() },
    })

    return { ok: true, updated: result.count }
  }
}
