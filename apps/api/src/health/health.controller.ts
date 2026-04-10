import { Controller, Get, Optional } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../prisma/prisma.service'
import { MetricsService } from '../common/metrics/metrics.service'
import { QueueService } from '../queue/queue.service'
import { isGoogleOAuthConfigured } from '../common/config/google-oauth-env'
import { getWhatsAppProviderReadiness } from '../whatsapp/providers/provider.factory'
import { TenantOperationsService } from '../common/tenant-ops/tenant-ops.service'

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: MetricsService,
    private readonly tenantOps: TenantOperationsService,
    private readonly config: ConfigService,
    @Optional() private readonly queueService?: QueueService,
  ) {}

  private hasValue(name: string): boolean {
    return (this.config.get<string>(name) ?? '').trim().length > 0
  }

  @Get()
  async health() {
    const startedAt = Date.now()

    let database = { ok: false as boolean, latencyMs: 0 }
    let prismaClient = { ok: false as boolean }
    const queueSummary = this.queueService
      ? await this.queueService.getQueueStatus().catch(() => ({ ok: false }))
      : { ok: true, reason: 'queue_service_not_bound' }
    const queue = {
      ok: (queueSummary as any)?.ok === false ? false : true,
      provider: 'bullmq',
      summary: queueSummary,
    }

    try {
      await this.prisma.$queryRaw`SELECT 1`
      database = { ok: true, latencyMs: Date.now() - startedAt }
      prismaClient = { ok: true }
    } catch {
      database = { ok: false, latencyMs: Date.now() - startedAt }
      prismaClient = { ok: false }
    }

    const ok = database.ok && prismaClient.ok && queue.ok

    return {
      status: ok ? 'ok' : 'degraded',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      checks: {
        database,
        prismaClient,
        queue,
      },
      metrics: this.metrics.snapshot(),
      tenantOperations: this.tenantOps.snapshot(),
    }
  }

  @Get('readiness')
  readiness() {
    const stripeConfigured =
      this.hasValue('STRIPE_SECRET_KEY')
      && this.hasValue('STRIPE_WEBHOOK_SECRET')
      && this.hasValue('STRIPE_PRICE_STARTER')
      && this.hasValue('STRIPE_PRICE_PRO')
      && this.hasValue('STRIPE_PRICE_BUSINESS')

    const googleAuthConfigured = isGoogleOAuthConfigured(this.config)

    const emailConfigured = this.hasValue('RESEND_API_KEY')
    const whatsappReadiness = getWhatsAppProviderReadiness(process.env)

    const whatsappIntegrationStatus = whatsappReadiness.mode === 'mock'
      ? 'configured_mock'
      : whatsappReadiness.isReady
        ? 'configured'
        : 'misconfigured'

    const readinessStatus = whatsappReadiness.mode === 'real' && !whatsappReadiness.isReady
      ? 'degraded'
      : 'ok'

    return {
      status: readinessStatus,
      timestamp: new Date().toISOString(),
      integrations: {
        stripe: stripeConfigured ? 'configured' : 'missing',
        googleAuth: googleAuthConfigured ? 'configured' : 'missing',
        email: emailConfigured ? 'configured' : 'missing',
        whatsapp: whatsappIntegrationStatus,
      },
      whatsapp: {
        providerRequested: whatsappReadiness.providerRequested,
        providerResolved: whatsappReadiness.providerResolved,
        isProviderKnown: whatsappReadiness.isProviderKnown,
        mode: whatsappReadiness.mode,
        credentialsReady: whatsappReadiness.credentialsReady,
        missingEnv: whatsappReadiness.missingEnv,
      },
    }
  }
}
