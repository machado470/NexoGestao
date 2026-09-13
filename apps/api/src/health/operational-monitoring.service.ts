import { Injectable } from '@nestjs/common'
import { BillingService } from '../billing/billing.service'
import { WhatsAppObservabilityService } from '../common/metrics/whatsapp-observability.service'
import { NotificationPubSubService } from '../notifications/notification-pubsub.service'
import { OutboxRepository } from '../outbox/outbox.repository'
import { PrismaService } from '../prisma/prisma.service'
import { QUEUE_NAMES } from '../queue/queue.constants'
import { QueueService } from '../queue/queue.service'
import { getWhatsAppProviderReadiness } from '../whatsapp/providers/provider.factory'
import {
  DependencyObservation,
  FactualOperationsSnapshot,
  OperationalDlqStatus,
  OperationalQueueStatus,
  OperationalRecoveryAction,
} from './operational-monitoring.types'

@Injectable()
export class OperationalMonitoringService {
  constructor(
    private readonly queueService: QueueService,
    private readonly waMetrics: WhatsAppObservabilityService,
    private readonly prisma: PrismaService,
    private readonly pubSub: NotificationPubSubService,
    private readonly outbox: OutboxRepository,
    private readonly billing: BillingService,
  ) {}

  async queues(): Promise<OperationalQueueStatus[]> {
    const raw = await this.queueService.getQueueStatus() as Record<string, any>
    if (raw?.ok === false) return []

    const queues = raw.queues ?? raw
    return Object.entries(queues).map(([queue, counts]) => {
      const c = counts as Record<string, number>
      return {
        queue,
        waiting: Number(c.waiting ?? 0),
        active: Number(c.active ?? 0),
        completed: Number(c.completed ?? 0),
        failed: Number(c.failed ?? 0),
        delayed: Number(c.delayed ?? 0),
        // Kept for backward shape compatibility. Counts do not derive health.
        degraded: false,
        degradedReasons: [],
      }
    })
  }

  async dlq(): Promise<OperationalDlqStatus[]> {
    const queueStatuses = await this.queues()
    if (queueStatuses.length === 0) return []
    const map = new Map(queueStatuses.map((q) => [q.queue, q]))
    const wa = this.waMetrics.snapshot()
    return [
      { queue: QUEUE_NAMES.WEBHOOKS_DLQ, backlog: map.get(QUEUE_NAMES.WEBHOOKS_DLQ)?.waiting ?? 0, failed: map.get(QUEUE_NAMES.WEBHOOKS)?.failed ?? 0, lastFailureAt: null },
      { queue: QUEUE_NAMES.WHATSAPP_DLQ, backlog: map.get(QUEUE_NAMES.WHATSAPP_DLQ)?.waiting ?? 0, failed: Number(wa.whatsapp_inbound_webhook_failed_total ?? 0), lastFailureAt: null },
    ]
  }

  async factualSnapshot(): Promise<FactualOperationsSnapshot> {
    const [database, queue, outbox] = await Promise.all([
      this.observeDatabase(),
      this.observeQueue(),
      this.observeOutbox(),
    ])

    return {
      contractVersion: 2,
      observedAt: new Date().toISOString(),
      dependencies: [
        database,
        ...queue,
        this.observeNotificationTransport(),
        outbox,
        this.observeWhatsApp(),
        this.observeBilling(),
      ],
    }
  }

  private async observeDatabase(): Promise<DependencyObservation> {
    const startedAt = Date.now()
    try {
      await this.prisma.$queryRaw`SELECT 1`
      return { component: 'postgresql', availability: 'available', observedAt: new Date().toISOString(), latencyMs: Date.now() - startedAt }
    } catch {
      return { component: 'postgresql', availability: 'unavailable', observedAt: new Date().toISOString(), latencyMs: Date.now() - startedAt }
    }
  }

  private async observeQueue(): Promise<DependencyObservation[]> {
    const startedAt = Date.now()
    try {
      const raw = await this.queueService.getQueueStatus() as Record<string, any>
      const latencyMs = Date.now() - startedAt
      const observedAt = new Date().toISOString()
      if (raw?.ok === false) {
        return [
          { component: 'redis', availability: 'unavailable', observedAt, latencyMs },
          { component: 'queue', availability: 'unavailable', observedAt, latencyMs },
        ]
      }
      const queues = raw.queues ?? raw
      const dlqBacklog = {
        [QUEUE_NAMES.WEBHOOKS_DLQ]: Number(queues[QUEUE_NAMES.WEBHOOKS_DLQ]?.waiting ?? 0),
        [QUEUE_NAMES.WHATSAPP_DLQ]: Number(queues[QUEUE_NAMES.WHATSAPP_DLQ]?.waiting ?? 0),
      }
      return [
        { component: 'redis', availability: 'available', observedAt, latencyMs },
        {
          component: 'queue', availability: 'available', observedAt, latencyMs,
          facts: { queues, dlqBacklog, stalledEvents: raw.stalledEvents ?? {} },
        },
      ]
    } catch {
      const observedAt = new Date().toISOString()
      return [
        { component: 'redis', availability: 'unknown', observedAt },
        { component: 'queue', availability: 'unknown', observedAt },
      ]
    }
  }

  private observeNotificationTransport(): DependencyObservation {
    const observedAt = new Date().toISOString()
    const readiness = this.pubSub.readiness()
    const diagnostic = this.pubSub.diagnostics()
    const available = readiness.publisherReady && readiness.subscriberReady && readiness.subscribed && !readiness.shuttingDown
    return {
      component: 'notification_pubsub',
      availability: available ? 'available' : 'unavailable',
      observedAt,
      facts: {
        publisher: readiness.publisherReady ? 'available' : 'unavailable',
        subscriber: readiness.subscriberReady ? 'available' : 'unavailable',
        subscription: readiness.subscribed ? 'available' : 'unavailable',
        ...(diagnostic.lastPublish ? { lastPublish: diagnostic.lastPublish } : {}),
      },
    }
  }

  private async observeOutbox(): Promise<DependencyObservation> {
    try {
      const facts = await this.outbox.factualSnapshot()
      const observedAt = new Date().toISOString()
      return {
        component: 'outbox', availability: 'available', observedAt,
        facts: {
          pending: facts.pending,
          backlog: facts.pending,
          failed: facts.failed,
          processing: facts.processing,
          oldestPendingAt: facts.oldestPendingAt?.toISOString() ?? null,
          oldestPendingAgeMs: facts.oldestPendingAt ? Math.max(0, Date.now() - facts.oldestPendingAt.getTime()) : null,
        },
      }
    } catch {
      return { component: 'outbox', availability: 'unknown', observedAt: new Date().toISOString() }
    }
  }

  private observeWhatsApp(): DependencyObservation {
    const observedAt = new Date().toISOString()
    try {
      const readiness = getWhatsAppProviderReadiness(process.env)
      const configured = readiness.credentialsReady
      return {
        component: 'whatsapp_provider',
        configured,
        availability: !configured ? 'not_configured' : readiness.mode === 'mock' ? 'available' : 'unknown',
        observedAt,
        facts: { providerRequested: readiness.providerRequested, providerResolved: readiness.providerResolved, mode: readiness.mode },
      }
    } catch {
      return { component: 'whatsapp_provider', configured: false, availability: 'not_configured', observedAt }
    }
  }

  private observeBilling(): DependencyObservation {
    const configured = this.billing.isStripeConfigured
    return {
      component: 'billing_stripe',
      configured,
      availability: configured ? 'unknown' : 'not_configured',
      observedAt: new Date().toISOString(),
    }
  }

  recoveryActions(): OperationalRecoveryAction[] {
    return [
      { id: 'replay_failed_webhook', label: 'Replay failed webhook delivery', endpoint: '/webhooks/deliveries/:deliveryId/replay', method: 'POST', available: true },
      { id: 'retry_failed_message', label: 'Retry failed WhatsApp message', endpoint: '/whatsapp/messages/:messageId/retry', method: 'POST', available: true },
    ]
  }

  async summary() {
    const [queues, dlq, factual] = await Promise.all([this.queues(), this.dlq(), this.factualSnapshot()])
    const wa = this.waMetrics.snapshot()
    return {
      // Legacy presentation fields remain stable, but no queue threshold or
      // retained failure count creates an operational classification.
      status: 'ok',
      degradedReasons: [],
      healthTimeline: { timestamp: factual.observedAt, latencyMs: 0 },
      metrics: {
        retries: wa.whatsapp_retry_total,
        failedJobs: wa.whatsapp_failed_jobs_total,
        failedWebhooks: wa.whatsapp_failed_webhook_total,
      },
      queues,
      dlq,
      recoveryActions: this.recoveryActions(),
      factual,
    }
  }
}
