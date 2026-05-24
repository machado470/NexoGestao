import { Injectable } from '@nestjs/common'
import { OperationalIncident } from './operational-monitoring.types'
import { OperationalMonitoringService } from './operational-monitoring.service'

@Injectable()
export class OperationalIncidentsService {
  constructor(private readonly monitoring: OperationalMonitoringService) {}

  async list(): Promise<OperationalIncident[]> {
    const summary = await this.monitoring.summary()
    const now = new Date().toISOString()
    const incidents: OperationalIncident[] = []

    for (const reason of summary.degradedReasons ?? []) {
      incidents.push({
        id: `health:${reason}`,
        severity: 'WARNING',
        code: 'HEALTH_DEGRADED_REASON',
        title: 'Health degradado',
        description: `Motivo degradado detectado: ${reason}`,
        source: 'HEALTH',
        createdAt: now,
        metadata: { reason },
      })
    }

    for (const q of summary.queues) {
      if (!q.degraded) continue
      incidents.push({
        id: `queue:${q.queue}`,
        severity: q.failed > 0 ? 'CRITICAL' : 'WARNING',
        code: 'QUEUE_DEGRADED',
        title: `Fila degradada: ${q.queue}`,
        description: `Fila com sinais degradados (${q.degradedReasons.join(', ')})`,
        source: 'QUEUE',
        createdAt: now,
        metadata: q as unknown as Record<string, unknown>,
      })
    }

    for (const d of summary.dlq) {
      if (d.backlog <= 0 && d.failed <= 0) continue
      incidents.push({
        id: `dlq:${d.queue}`,
        severity: d.backlog > 10 ? 'CRITICAL' : 'WARNING',
        code: 'DLQ_BACKLOG',
        title: `DLQ backlog em ${d.queue}`,
        description: `DLQ possui backlog=${d.backlog} e failed=${d.failed}`,
        source: 'QUEUE',
        createdAt: now,
        metadata: d as unknown as Record<string, unknown>,
      })
    }

    if ((summary.metrics.retries ?? 0) > 0) {
      incidents.push({ id: 'metrics:retries', severity: 'INFO', code: 'RETRY_ACTIVITY', title: 'Retries observados', description: `Total de retries observado: ${summary.metrics.retries}`, source: 'METRICS', createdAt: now })
    }

    return incidents
  }
}
