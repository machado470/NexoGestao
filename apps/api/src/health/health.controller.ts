import { Controller, Get, Logger, Optional, Query, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../prisma/prisma.service'
import { MetricsService } from '../common/metrics/metrics.service'
import { QueueService } from '../queue/queue.service'
import { isGoogleOAuthConfigured } from '../common/config/google-oauth-env'
import { getWhatsAppProviderReadiness } from '../whatsapp/providers/provider.factory'
import { TenantOperationsService } from '../common/tenant-ops/tenant-ops.service'
import { CommercialPolicyService } from '../common/commercial/commercial-policy.service'

@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: MetricsService,
    private readonly tenantOps: TenantOperationsService,
    private readonly commercial: CommercialPolicyService,
    private readonly config: ConfigService,
    @Optional() private readonly queueService?: QueueService,
  ) {}

  private hasValue(name: string): boolean {
    return (this.config.get<string>(name) ?? '').trim().length > 0
  }

  @Get()
  async health(@Query('details') details?: string) {
    const startedAt = Date.now()
    const includeDetails = details === '1' || details === 'true'
    const queueTimeoutMs = 1200

    let database = { ok: false as boolean, latencyMs: 0 }
    let prismaClient = { ok: false as boolean }
    const queueStartedAt = Date.now()
    const queueSummary = this.queueService
      ? await Promise.race([
          this.queueService.getQueueStatus(),
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: false,
                  reason: `queue_status_timeout_${queueTimeoutMs}ms`,
                }),
              queueTimeoutMs,
            ),
          ),
        ]).catch((error: unknown) => ({
          ok: false,
          reason: error instanceof Error ? error.message : String(error),
        }))
      : { ok: true, reason: 'queue_service_not_bound' }
    const queue = {
      ok: (queueSummary as any)?.ok === false ? false : true,
      provider: 'bullmq',
      latencyMs: Date.now() - queueStartedAt,
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

    let diagnostics: Record<string, unknown> | undefined
    if (includeDetails) {
      const diagnosticsStartedAt = Date.now()
      diagnostics = {
        tenantOperations: this.tenantOps.snapshot(),
      }

      try {
        const commercial = await Promise.race([
          this.commercial.getAdminTenantCommercialOverview(),
          new Promise((resolve) =>
            setTimeout(() => resolve({ timeout: true, reason: 'commercial_overview_timeout' }), 1500),
          ),
        ])
        diagnostics.commercial = commercial
      } catch (error) {
        this.logger.warn(`Falha ao coletar diagnóstico comercial no /health?details=1: ${
          error instanceof Error ? error.message : String(error)
        }`)
        diagnostics.commercial = {
          ok: false,
          reason: error instanceof Error ? error.message : String(error),
        }
      }

      diagnostics.latencyMs = Date.now() - diagnosticsStartedAt
    }

    return {
      status: ok ? 'ok' : 'degraded',
      mode: includeDetails ? 'detailed' : 'startup',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
      checks: {
        database,
        prismaClient,
        queue,
      },
      metrics: this.metrics.snapshot(),
      diagnostics,
    }
  }

  @Get('readiness')
  async readiness() {
    const startedAt = Date.now()
    const checks = await this.collectCriticalChecks()
    const ok = checks.database.ok && checks.prismaClient.ok && checks.queue.ok

    const body = {
      status: ok ? 'ready' : 'not_ready',
      timestamp: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
      checks,
      notes: [
        '[READY] /health/readiness valida dependências críticas de operação.',
        '[OPTIONAL] Stripe/Google OAuth/Resend/WhatsApp/Sentry ausentes não impedem startup local.',
      ],
      integrations: this.optionalIntegrations(),
    }

    if (!ok) {
      throw new ServiceUnavailableException(body)
    }

    return body
  }

  @Get('liveness')
  liveness() {
    return {
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    }
  }

  private async collectCriticalChecks() {
    const databaseStartedAt = Date.now()
    let database = { ok: false as boolean, latencyMs: 0 }
    let prismaClient = { ok: false as boolean }

    try {
      await this.prisma.$queryRaw`SELECT 1`
      database = { ok: true, latencyMs: Date.now() - databaseStartedAt }
      prismaClient = { ok: true }
    } catch {
      database = { ok: false, latencyMs: Date.now() - databaseStartedAt }
      prismaClient = { ok: false }
    }

    const queueStartedAt = Date.now()
    const queueSummary = this.queueService
      ? await this.queueService.getQueueStatus().catch((error: unknown) => ({
          ok: false,
          reason: error instanceof Error ? error.message : String(error),
        }))
      : { ok: false, reason: 'queue_service_not_bound' }

    const queue = {
      ok: (queueSummary as any)?.ok === false ? false : true,
      provider: 'bullmq',
      enabled: this.queueService?.isEnabled() ?? false,
      latencyMs: Date.now() - queueStartedAt,
      summary: queueSummary,
    }

    return { database, prismaClient, queue }
  }

  private optionalIntegrations() {
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

    return {
      stripe: stripeConfigured ? 'configured' : 'missing',
      googleAuth: googleAuthConfigured ? 'configured' : 'missing',
      email: emailConfigured ? 'configured' : 'missing',
      whatsapp: whatsappIntegrationStatus,
      whatsappDetails: {
        providerRequested: whatsappReadiness.providerRequested,
        providerResolved: whatsappReadiness.providerResolved,
        isProviderKnown: whatsappReadiness.isProviderKnown,
        mode: whatsappReadiness.mode,
        credentialsReady: whatsappReadiness.credentialsReady,
        missingEnv: whatsappReadiness.missingEnv,
        queueAvailable: this.queueService?.isEnabled() ?? false,
      },
    }
  }
}
