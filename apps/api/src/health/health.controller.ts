import { Controller, Get } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../prisma/prisma.service'
import { MetricsService } from '../common/metrics/metrics.service'

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: MetricsService,
    private readonly config: ConfigService,
  ) {}

  private hasValue(name: string): boolean {
    return (this.config.get<string>(name) ?? '').trim().length > 0
  }

  @Get()
  async health() {
    const startedAt = Date.now()

    let database = { ok: false as boolean, latencyMs: 0 }
    let prismaClient = { ok: false as boolean }
    const queue = { ok: true, provider: 'database-backed queue' }

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
    }
  }

  @Get('readiness')
  readiness() {
    const stripeConfigured =
      this.hasValue('STRIPE_SECRET_KEY') &&
      this.hasValue('STRIPE_WEBHOOK_SECRET') &&
      this.hasValue('STRIPE_PRICE_STARTER') &&
      this.hasValue('STRIPE_PRICE_PRO') &&
      this.hasValue('STRIPE_PRICE_BUSINESS')

    const googleAuthConfigured =
      this.hasValue('GOOGLE_CLIENT_ID') &&
      this.hasValue('GOOGLE_CLIENT_SECRET') &&
      this.hasValue('GOOGLE_REDIRECT_URL')

    const emailConfigured = this.hasValue('RESEND_API_KEY')
    const whatsappConfigured = this.hasValue('WHATSAPP_PROVIDER')

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      integrations: {
        stripe: stripeConfigured ? 'configured' : 'missing',
        googleAuth: googleAuthConfigured ? 'configured' : 'missing',
        email: emailConfigured ? 'configured' : 'missing',
        whatsapp: whatsappConfigured ? 'configured' : 'missing',
      },
    }
  }
}
