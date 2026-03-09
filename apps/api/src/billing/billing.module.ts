import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { BillingService } from './billing.service'
import { BillingController } from './billing.controller'
import { ConfigModule } from '@nestjs/config'
import { QuotasModule } from '../quotas/quotas.module'

@Module({
  imports: [
    PrismaModule,
    ConfigModule,
    QuotasModule
  ],
  providers: [BillingService],
  controllers: [BillingController],
  exports: [BillingService]
})
export class BillingModule {}
