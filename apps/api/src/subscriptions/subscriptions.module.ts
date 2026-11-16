import { Module } from '@nestjs/common'
import { SubscriptionsService } from './subscriptions.service'
import { SubscriptionsController } from './subscriptions.controller'
import { PrismaModule } from '../prisma/prisma.module'
import { BillingModule } from '../billing/billing.module'
import { ActiveUserGuard } from '../auth/guards/active-user.guard'
import { PlansModule } from '../plans/plans.module'

@Module({
  imports: [PrismaModule, PlansModule, BillingModule],
  providers: [SubscriptionsService, ActiveUserGuard],
  controllers: [SubscriptionsController],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
