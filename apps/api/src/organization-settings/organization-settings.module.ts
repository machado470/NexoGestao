import { Module } from '@nestjs/common';
import { OrganizationSettingsService } from './organization-settings.service';
import { OrganizationSettingsController } from './organization-settings.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, SubscriptionsModule, AuthModule],
  providers: [OrganizationSettingsService],
  controllers: [OrganizationSettingsController],
  exports: [OrganizationSettingsService],
})
export class OrganizationSettingsModule {}
