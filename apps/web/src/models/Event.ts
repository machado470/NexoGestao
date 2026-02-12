export type EventType =
  | 'RISK_DETECTED'
  | 'TRACK_ASSIGNED'
  | 'ASSESSMENT_COMPLETED'
  | 'CORRECTIVE_ACTION'

export type EventSeverity = 'INFO' | 'WARNING' | 'CRITICAL'

export type Event = {
  id: string
  date: string
  type: EventType
  severity: EventSeverity
  description: string
}
