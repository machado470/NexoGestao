import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ScheduleModule } from '@nestjs/schedule'
import { ClsModule } from 'nestjs-cls'
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core'
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler'
import { TenantAccessGuard } from './common/guards/tenant-access.guard'

import { CoreModule } from './core/core.module'
import { OrgContextInterceptor } from './auth/org-context.interceptor'
import { RequestLoggerMiddleware } from './common/middleware/request-logger.middleware'
import { PrismaModule } from './prisma/prisma.module'
import { HealthModule } from './health/health.module'
import { MetricsService } from './common/metrics/metrics.service'

import { BootstrapModule } from './bootstrap/bootstrap.module'
import { AuthModule } from './auth/auth.module'
import { MeModule } from './me/me.module'
import { OnboardingModule } from './onboarding/onboarding.module'

import { PeopleModule } from './people/people.module'
import { TracksModule } from './tracks/tracks.module'
import { TrackItemsModule } from './track-items/track-items.module'
import { AssignmentsModule } from './assignments/assignments.module'
import { AssessmentsModule } from './assessments/assessments.module'
import { RiskModule } from './risk/risk.module'
import { AuditModule } from './audit/audit.module'

import { CustomersModule } from './customers/customers.module'
import { AppointmentsModule } from './appointments/appointments.module'
import { ServiceOrdersModule } from './service-orders/service-orders.module'
import { ExecutionModule } from './execution/execution.module'
import { FinanceModule } from './finance/finance.module'
import { WhatsAppModule } from './whatsapp/whatsapp.module'
import { InvitesModule } from './invites/invites.module'
import { AutomationModule } from './automation/automation.module'
import { NotificationsModule } from './notifications/notifications.module'
import { SubscriptionsModule } from './subscriptions/subscriptions.module'
import { QueueModule } from './queue/queue.module'
// Módulos adicionados — estavam implementados mas não registrados no AppModule
import { TimelineModule } from './timeline/timeline.module'
import { GovernanceModule } from './governance/governance.module'
import { ExpensesModule } from './expenses/expenses.module'
import { InvoicesModule } from './invoices/invoices.module'
import { DashboardModule } from './dashboard/dashboard.module'
import { ReportsModule } from './reports/reports.module'
import { PlansModule } from './plans/plans.module'
import { EmailModule } from './email/email.module'
import { PaymentsModule } from './payments/payments.module'
import { BillingModule } from './billing/billing.module'
import { DemoModule } from './demo/demo.module'
import { AnalyticsModule } from './analytics/analytics.module'
import { CorrectiveActionsModule } from './corrective-actions/corrective-actions.module'
import { AdminModule } from './admin/admin.module'
import { PendingModule } from './pending/pending.module'
import { ExceptionsModule } from './exceptions/exceptions.module'
import { LaunchesModule } from './launches/launches.module'
import { ReferralsModule } from './referrals/referrals.module'
import { OrganizationSettingsModule } from './organization-settings/organization-settings.module'
import { WebhookModule } from './webhooks/webhook.module'
import { SentryModule } from './common/sentry/sentry.module'
import { CommercialModule } from './commercial/commercial.module'

@Module({
  imports: [
    CoreModule,

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

    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 20 },
      { name: 'medium', ttl: 60000, limit: 200 },
      { name: 'long', ttl: 3600000, limit: 1000 },
    ]),

    ScheduleModule.forRoot(),

    ClsModule.forRoot({
      global: true,
      middleware: { mount: true },
    }),

    PrismaModule,
    HealthModule,
    QueueModule,
    SentryModule,
    AnalyticsModule,
    EmailModule,
    WebhookModule,
    CommercialModule,

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
    TimelineModule,
    CorrectiveActionsModule,
    ExceptionsModule,
    PendingModule,

    CustomersModule,
    AppointmentsModule,
    ServiceOrdersModule,
    ExecutionModule,
    FinanceModule,
    PaymentsModule,
    ExpensesModule,
    InvoicesModule,
    BillingModule,
    DemoModule,
    WhatsAppModule,
    InvitesModule,
    AutomationModule,
    NotificationsModule,
    SubscriptionsModule,
    PlansModule,
    GovernanceModule,
    DashboardModule,
    ReportsModule,
    AdminModule,
    OrganizationSettingsModule,
    LaunchesModule,
    ReferralsModule,
  ],
  providers: [
    MetricsService,
    {
      provide: APP_INTERCEPTOR,
      useClass: OrgContextInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: TenantAccessGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes('*')
  }
}
