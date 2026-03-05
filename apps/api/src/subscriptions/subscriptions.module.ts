import { Module } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionsController } from './subscriptions.controller';
import { PrismaService } from '../prisma/prisma.service';
import { PlansModule } from '../plans/plans.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PlansModule, AuthModule],
  providers: [SubscriptionsService, PrismaService],
  controllers: [SubscriptionsController],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
