import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { SubscriptionsModule } from '../subscriptions/subscriptions.module'
import { BootstrapController } from './bootstrap.controller'
import { BootstrapService } from './bootstrap.service'
import { DevSeedService } from './dev-seed.service'

@Module({
  imports: [PrismaModule, SubscriptionsModule],
  controllers: [BootstrapController],
  providers: [BootstrapService, DevSeedService],
})
export class BootstrapModule {}
