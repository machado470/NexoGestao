import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationType } from '@prisma/client';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async createNotification(
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
    });
  }

  async getNotifications(orgId: string, userId?: string) {
    const where: any = { orgId };
    if (userId) {
      where.userId = userId;
    }
    return this.prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async markAsRead(notificationId: string) {
    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { readAt: new Date() },
    });
  }
}
