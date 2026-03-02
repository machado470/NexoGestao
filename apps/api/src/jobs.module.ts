import { Module } from '@nestjs/common'
import { ScheduleModule } from '@nestjs/schedule'
import { GovernanceModule } from './governance/governance.module'
import { EnforcementScheduler } from './governance/enforcement.scheduler'

@Module({
  imports: [
    ScheduleModule.forRoot(),
    GovernanceModule,
  ],
  providers: [
    EnforcementScheduler,
  ],
})
export class JobsModule {}
