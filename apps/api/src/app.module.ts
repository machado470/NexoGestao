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
import { FinanceModule } from './finance/finance.module'
import { WhatsAppModule } from './whatsapp/whatsapp.module'
import { InvitesModule } from './invites/invites.module'
import { AutomationModule } from './automation/automation.module'
import { NotificationsModule } from './notifications/notifications.module'
import { SubscriptionsModule } from './subscriptions/subscriptions.module'
import { QueueModule } from './queue/queue.module'

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

    CustomersModule,
    AppointmentsModule,
    ServiceOrdersModule,
    FinanceModule,
    WhatsAppModule,
    InvitesModule,
    AutomationModule,
    NotificationsModule,
    SubscriptionsModule,
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
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes('*')
  }
}
