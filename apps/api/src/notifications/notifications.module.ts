import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { PrismaService } from '../prisma/prisma.service';
import { AuthModule } from '../auth/auth.module';
import { QueueModule } from '../queue/queue.module';
import { NotificationProcessor } from '../queue/processors/notification.processor';

@Module({
  imports: [AuthModule, QueueModule],
  providers: [NotificationsService, PrismaService, NotificationProcessor],
  controllers: [NotificationsController],
  exports: [NotificationsService],
})
export class NotificationsModule {}
