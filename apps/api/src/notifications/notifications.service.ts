import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
// import { NotificationType } from '@prisma/client'
export type NotificationType = string
import { QueueService } from '../queue/queue.service'
import { QUEUE_NAMES } from '../queue/queue.constants'

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private readonly queueService: QueueService,
  ) {}

  private get notificationDelegate(): any | null {
    const prismaAny = this.prisma as any
    return prismaAny.notification ?? null
  }

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
    const delegate = this.notificationDelegate

    if (!delegate) {
      return {
        disabled: true,
        reason: 'Notification model não está disponível no Prisma atual.',
        orgId,
        type,
        message,
        userId: userId ?? null,
        metadata: metadata ?? null,
      }
    }

    return delegate.create({
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
    const delegate = this.notificationDelegate
    if (!delegate) return []

    const where: any = { orgId }
    if (userId) {
      where.OR = [{ userId }, { userId: null }]
    }

    return delegate.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })
  }

  async getUnreadCount(orgId: string, userId: string) {
    const delegate = this.notificationDelegate
    if (!delegate) return 0

    return delegate.count({
      where: {
        orgId,
        readAt: null,
        OR: [{ userId }, { userId: null }],
      },
    })
  }

  async markAsRead(orgId: string, userId: string, notificationId: string) {
    const delegate = this.notificationDelegate
    if (!delegate) {
      return { ok: true, disabled: true }
    }

    const result = await delegate.updateMany({
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
    const delegate = this.notificationDelegate
    if (!delegate) {
      return { ok: true, updated: 0, disabled: true }
    }

    const result = await delegate.updateMany({
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
