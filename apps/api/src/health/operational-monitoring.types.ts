export type OperationalIncidentSeverity = 'INFO' | 'WARNING' | 'CRITICAL'

export interface OperationalIncident {
  id: string
  severity: OperationalIncidentSeverity
  code: string
  title: string
  description: string
  source: 'HEALTH' | 'QUEUE' | 'WEBHOOK' | 'WHATSAPP' | 'METRICS' | 'RECOVERY'
  createdAt: string
  metadata?: Record<string, unknown>
}

export interface OperationalQueueStatus {
  queue: string
  waiting: number
  active: number
  completed: number
  failed: number
  delayed: number
  degraded: boolean
  degradedReasons: string[]
}

export interface OperationalDlqStatus {
  queue: string
  backlog: number
  failed: number
  lastFailureAt: string | null
}

export interface OperationalRecoveryAction {
  id: string
  label: string
  endpoint: string
  method: 'POST'
  available: boolean
}

export type FactualAvailability = 'available' | 'unavailable' | 'not_configured' | 'unknown'

export interface DependencyObservation {
  component: string
  availability: FactualAvailability
  observedAt: string
  latencyMs?: number
  configured?: boolean
  facts?: Record<string, unknown>
}

export interface FactualOperationsSnapshot {
  contractVersion: 2
  observedAt: string
  dependencies: DependencyObservation[]
}
