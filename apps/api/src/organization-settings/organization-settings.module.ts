import { Module } from '@nestjs/common';
import { OrganizationSettingsService } from './organization-settings.service';
import { OrganizationSettingsController } from './organization-settings.controller';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaService, SubscriptionsModule, AuthModule],
  providers: [OrganizationSettingsService, PrismaService],
  controllers: [OrganizationSettingsController],
  exports: [OrganizationSettingsService],
})
export class OrganizationSettingsModule {}
