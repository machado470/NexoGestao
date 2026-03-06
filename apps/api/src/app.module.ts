import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ScheduleModule } from '@nestjs/schedule'
import { ClsModule } from 'nestjs-cls'
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core'
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler'
import { OrgContextInterceptor } from './auth/org-context.interceptor'
import { RequestLoggerMiddleware } from './common/middleware/request-logger.middleware'
import { RequestContextService } from './common/context/request-context.service'
import { MetricsService } from './common/metrics/metrics.service'

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
import { ExecutionModule } from './execution/execution.module'

// 💰 NEXOGESTÃO OFICIAL — Financeiro
import { FinanceModule } from './finance/finance.module'
import { PaymentsModule } from './payments/payments.module'

// 📲 WhatsApp — Meu Acessor (infra + dispatcher)
import { WhatsAppModule } from './whatsapp/whatsapp.module'

// 📧 E-mail
import { EmailModule } from './email/email.module'

// 📊 DASHBOARD EXECUTIVO
import { DashboardModule } from './dashboard/dashboard.module'

// 💸 MÓDULOS FINANCEIROS COMPLETOS
import { ExpensesModule } from './expenses/expenses.module'
import { InvoicesModule } from './invoices/invoices.module'
import { LaunchesModule } from './launches/launches.module'
import { ReferralsModule } from './referrals/referrals.module'
import { InvitesModule } from './invites/invites.module'
import { PlansModule } from './plans/plans.module'
import { SubscriptionsModule } from './subscriptions/subscriptions.module'
import { NotificationsModule } from './notifications/notifications.module'
import { OrganizationSettingsModule } from './organization-settings/organization-settings.module'

// 💳 BILLING (Stripe)
import { BillingModule } from './billing/billing.module'

// 📊 ANALYTICS DE PRODUTO
import { AnalyticsModule } from './analytics/analytics.module'
import { AutomationModule } from './automation/automation.module'

// 🚨 SENTRY (Monitoramento)
import { SentryModule } from './common/sentry/sentry.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        '../../.env.test',
        '.env.test',
        '../../.env',
        '../../.env.docker',
        '.env',
        '.env.docker',
      ],
    }),

    // ✅ Rate Limiting global
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,
        limit: 20,
      },
      {
        name: 'medium',
        ttl: 60000,
        limit: 200,
      },
      {
        name: 'long',
        ttl: 3600000,
        limit: 1000,
      },
    ]),

    ScheduleModule.forRoot(),

    ClsModule.forRoot({
      global: true,
      middleware: { mount: true },
    }),

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

    // 💰 Operacional
    CustomersModule,
    AppointmentsModule,
    ServiceOrdersModule,
    ExecutionModule,
    FinanceModule,
    PaymentsModule,

    // 📲 WhatsApp (jobs + serviço)
    WhatsAppModule,

    // 📧 E-mail
    EmailModule,

    // 🔥 Governança
    GovernanceModule,

    // 📊 Dashboard Executivo
    DashboardModule,

    // 💸 Módulos financeiros completos
    ExpensesModule,
    InvoicesModule,
    LaunchesModule,
    ReferralsModule,
    InvitesModule,
    PlansModule,
    SubscriptionsModule,
    NotificationsModule,
    OrganizationSettingsModule,

    // 💳 Billing Stripe
    BillingModule,

    // 📊 Analytics de produto
    AnalyticsModule,
    AutomationModule,

    // 🚨 Sentry
    SentryModule,
  ],
  providers: [
    RequestContextService,
    MetricsService,
    {
      provide: APP_INTERCEPTOR,
      useClass: OrgContextInterceptor,
    },
    // ✅ Rate limiting global aplicado a todos os endpoints
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes('*')
  }
}
