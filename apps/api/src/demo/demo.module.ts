import { Module } from '@nestjs/common'
import { DemoController } from './demo.controller'
import { DemoService } from './demo.service'
import { CustomersModule } from '../customers/customers.module'
import { AppointmentsModule } from '../appointments/appointments.module'
import { ServiceOrdersModule } from '../service-orders/service-orders.module'
import { FinanceModule } from '../finance/finance.module'
import { PrismaModule } from '../prisma/prisma.module'
import { WhatsAppModule } from '../whatsapp/whatsapp.module'
import { RiskModule } from '../risk/risk.module'
import { GovernanceModule } from '../governance/governance.module'

@Module({
  imports: [
    PrismaModule,
    CustomersModule,
    AppointmentsModule,
    ServiceOrdersModule,
    FinanceModule,
    WhatsAppModule,
    RiskModule,
    GovernanceModule,
  ],
  controllers: [DemoController],
  providers: [DemoService],
})
export class DemoModule {}
