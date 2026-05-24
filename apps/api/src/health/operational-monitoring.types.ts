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
