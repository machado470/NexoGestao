import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ScheduleModule } from '@nestjs/schedule'

import { PrismaModule } from './prisma/prisma.module'
import { HealthModule } from './health/health.module'
import { AuthModule } from './auth/auth.module'
import { MeModule } from './me/me.module'
import { OnboardingModule } from './onboarding/onboarding.module'

// ✅ BOOTSTRAP (criar primeiro admin/org)
import { BootstrapModule } from './bootstrap/bootstrap.module'

// ✅ DOMÍNIO HUMANO ÚNICO
import { PeopleModule } from './people/people.module'

// domínio educacional
import { TracksModule } from './tracks/tracks.module'
import { TrackItemsModule } from './track-items/track-items.module'
import { AssignmentsModule } from './assignments/assignments.module'
import { AssessmentsModule } from './assessments/assessments.module'

// risco, tempo e auditoria
import { RiskModule } from './risk/risk.module'
import { AuditModule } from './audit/audit.module'

// ações corretivas e relatórios
import { CorrectiveActionsModule } from './corrective-actions/corrective-actions.module'
import { ReportsModule } from './reports/reports.module'

// leitura estratégica
import { PendingModule } from './pending/pending.module'
import { AdminModule } from './admin/admin.module'

// timeline
import { TimelineModule } from './timeline/timeline.module'

// exceções humanas
import { ExceptionsModule } from './exceptions/exceptions.module'

// 🧠 GOVERNANÇA OPERACIONAL
import { GovernanceModule } from './governance/governance.module'

// 🧩 NEXOGESTÃO OFICIAL — Clientes
import { CustomersModule } from './customers/customers.module'

// 🧩 NEXOGESTÃO OFICIAL — Agenda (Appointments)
import { AppointmentsModule } from './appointments/appointments.module'

// 🧩 NEXOGESTÃO OFICIAL — Ordens de Serviço (O.S.)
import { ServiceOrdersModule } from './service-orders/service-orders.module'

// 💰 NEXOGESTÃO OFICIAL — Financeiro
import { FinanceModule } from './finance/finance.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        '../../.env',
        '../../.env.docker',
        '.env',
        '.env.docker',
      ],
    }),

    ScheduleModule.forRoot(),

    PrismaModule,
    HealthModule,

    BootstrapModule,

    AuthModule,
    MeModule,
    OnboardingModule,

    PeopleModule,

    TracksModule,
    TrackItemsModule,
    AssignmentsModule,
    AssessmentsModule,

    RiskModule,
    AuditModule,

    CorrectiveActionsModule,
    ReportsModule,

    PendingModule,
    AdminModule,
    TimelineModule,

    ExceptionsModule,

    // 🧩 Operacional
    CustomersModule,
    AppointmentsModule,
    ServiceOrdersModule,
    FinanceModule,

    // 🔥 Governança
    GovernanceModule,
  ],
})
export class AppModule {}
