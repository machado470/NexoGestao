import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ScheduleModule } from '@nestjs/schedule'
import { ClsModule } from 'nestjs-cls'
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core'
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler'

import { CoreModule } from './core/core.module'

import { OrgContextInterceptor } from './auth/org-context.interceptor'
import { RequestLoggerMiddleware } from './common/middleware/request-logger.middleware'

import { PrismaModule } from './prisma/prisma.module'
import { HealthModule } from './health/health.module'
import { AuthModule } from './auth/auth.module'
import { MeModule } from './me/me.module'
import { OnboardingModule } from './onboarding/onboarding.module'
import { BootstrapModule } from './bootstrap/bootstrap.module'

import { PeopleModule } from './people/people.module'

import { TracksModule } from './tracks/tracks.module'
import { TrackItemsModule } from './track-items/track-items.module'
import { AssignmentsModule } from './assignments/assignments.module'
import { AssessmentsModule } from './assessments/assessments.module'

import { RiskModule } from './risk/risk.module'
import { AuditModule } from './audit/audit.module'

import { CorrectiveActionsModule } from './corrective-actions/corrective-actions.module'
import { ReportsModule } from './reports/reports.module'

import { PendingModule } from './pending/pending.module'
import { AdminModule } from './admin/admin.module'

import { TimelineModule } from './timeline/timeline.module'
import { ExceptionsModule } from './exceptions/exceptions.module'
import { GovernanceModule } from './governance/governance.module'

import { CustomersModule } from './customers/customers.module'
import { AppointmentsModule } from './appointments/appointments.module'

import { ServiceOrdersModule } from './service-orders/service-orders.module'
import { ExecutionModule } from './execution/execution.module'

import { FinanceModule } from './finance/finance.module'
import { PaymentsModule } from './payments/payments.module'

import { WhatsAppModule } from './whatsapp/whatsapp.module'
import { EmailModule } from './email/email.module'

import { DashboardModule } from './dashboard/dashboard.module'

import { ExpensesModule } from './expenses/expenses.module'
import { InvoicesModule } from './invoices/invoices.module'
import { LaunchesModule } from './launches/launches.module'

import { ReferralsModule } from './referrals/referrals.module'
import { InvitesModule } from './invites/invites.module'

import { PlansModule } from './plans/plans.module'
import { SubscriptionsModule } from './subscriptions/subscriptions.module'

import { NotificationsModule } from './notifications/notifications.module'
import { OrganizationSettingsModule } from './organization-settings/organization-settings.module'

import { BillingModule } from './billing/billing.module'

import { AnalyticsModule } from './analytics/analytics.module'
import { AutomationModule } from './automation/automation.module'
import { QueueModule } from './queue/queue.module'
import { WebhookModule } from './webhooks/webhook.module'

import { SentryModule } from './common/sentry/sentry.module'

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
    GovernanceModule,

    CustomersModule,
    AppointmentsModule,
    ServiceOrdersModule,
    ExecutionModule,

    FinanceModule,
    PaymentsModule,

    WhatsAppModule,
    EmailModule,

    DashboardModule,

    ExpensesModule,
    InvoicesModule,
    LaunchesModule,

    ReferralsModule,
    InvitesModule,

    PlansModule,
    SubscriptionsModule,

    NotificationsModule,
    OrganizationSettingsModule,

    BillingModule,

    AnalyticsModule,
    AutomationModule,
    QueueModule,
    WebhookModule,

    SentryModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: OrgContextInterceptor,
    },
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
